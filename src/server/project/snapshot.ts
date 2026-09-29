import type { Prisma } from "@/generated/prisma/client";
import type { ProjectAccess } from "@/lib/auth/access";
import { activeRole } from "@/lib/auth/period";
import { ASSIGNABLE_ROLES } from "@/lib/auth/roles";
import type { ProjectRole } from "@/lib/auth/types";
import type { TermStep } from "@/lib/finance/terms";
import { stageDefinition } from "@/lib/project/catalog";
import {
  developersOf,
  documentOf,
  financePocOf,
  type ProjectSnapshot,
  pmOf,
} from "@/lib/project/snapshot";
import {
  deriveStages,
  newlyCompletedStages,
  type StageState,
} from "@/lib/project/stages";
import { recordActivity, type Tx } from "@/server/activity";
import { ACTOR_SELECT, toActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { notify, projectHref } from "@/server/notify";

const USER_NAME = { select: { id: true, name: true } } as const;

export const SNAPSHOT_INCLUDE = {
  assignments: {
    where: { endedAt: null },
    orderBy: { startedAt: "asc" },
    include: { user: { select: ACTOR_SELECT } },
  },
  stages: true,
  documents: { include: { owner: USER_NAME } },
  submissions: {
    orderBy: { submittedAt: "asc" },
    include: { submittedBy: USER_NAME, decidedBy: USER_NAME },
  },
  staffing: true,
  techInfo: true,
  blockers: {
    orderBy: { createdAt: "asc" },
    include: { createdBy: USER_NAME },
  },
  milestones: { orderBy: [{ date: "asc" }, { sortOrder: "asc" }] },
  terms: { orderBy: { sequence: "asc" } },
  handover: true,
  disbursement: true,
} satisfies Prisma.ProjectInclude;

export type ProjectRow = Prisma.ProjectGetPayload<{
  include: typeof SNAPSHOT_INCLUDE;
}>;

/** Nama pelaku yang dirujuk lewat id tanpa relasi (staffing, disbursement). */
async function namesFor(
  ids: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, name: true },
  });
  return new Map(users.map((u) => [u.id, u.name]));
}

export function toSnapshot(
  row: ProjectRow,
  names: Map<string, string> = new Map(),
  now: Date = new Date(),
): ProjectSnapshot {
  const stageDeadlines: Record<number, Date> = {};
  const stageCompletedAt: Record<number, Date> = {};
  for (const stage of row.stages) {
    if (stage.deadline) stageDeadlines[stage.stage] = stage.deadline;
    if (stage.completedAt) stageCompletedAt[stage.stage] = stage.completedAt;
  }

  return {
    id: row.id,
    code: row.code,
    name: row.name,
    client: row.client,
    type: row.type,
    source: row.source,
    targetStart: row.targetStart,
    targetEnd: row.targetEnd,
    internalNote: row.internalNote,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    closedAt: row.closedAt,
    finalStatus: row.finalStatus,
    stage1DoneAt: row.stage1DoneAt,
    developmentDoneAt: row.developmentDoneAt,
    assignments: row.assignments.map((a) => {
      // Masih sah bila akunnya aktif dan jabatannya masih cocok dengan peran
      // di project. PM yang naik jabatan atau periodenya habis membuat
      // project "Perlu Penugasan Ulang" (PRD bab 2.5).
      const role = activeRole(toActor(a.user), now);
      return {
        userId: a.userId,
        name: a.user.name,
        role: a.role as ProjectRole,
        techRole: a.techRole,
        userActive:
          role !== null &&
          ASSIGNABLE_ROLES[a.role as ProjectRole].includes(role),
        startedAt: a.startedAt,
      };
    }),
    documents: row.documents.map((d) => ({
      id: d.id,
      kind: d.kind,
      developerId: d.developerId,
      url: d.url,
      status: d.status,
      deadline: d.deadline,
      signedAt: d.signedAt,
      ownerId: d.ownerId,
      ownerName: d.owner?.name ?? null,
      updatedAt: d.updatedAt,
    })),
    submissions: row.submissions.map((s) => ({
      id: s.id,
      kind: s.kind,
      documentId: s.documentId,
      status: s.status,
      submittedById: s.submittedById,
      submittedByName: s.submittedBy.name,
      submittedAt: s.submittedAt,
      decidedById: s.decidedById,
      decidedByName: s.decidedBy?.name ?? null,
      decidedAt: s.decidedAt,
      feedback: s.feedback,
    })),
    staffing: row.staffing && {
      technicalNeeds: row.staffing.technicalNeeds,
      roleRequested: row.staffing.roleRequested,
      headcount: row.staffing.headcount,
      neededBy: row.staffing.neededBy,
      status: row.staffing.status,
      submittedAt: row.staffing.submittedAt,
      assignedByName: row.staffing.assignedById
        ? (names.get(row.staffing.assignedById) ?? null)
        : null,
      assignedAt: row.staffing.assignedAt,
    },
    techInfo: row.techInfo && {
      githubRepo: row.techInfo.githubRepo,
      sprintPlanning: row.techInfo.sprintPlanning,
      currentSprint: row.techInfo.currentSprint,
      progressPercent: row.techInfo.progressPercent,
      nextMilestone: row.techInfo.nextMilestone,
      latestUpdate: row.techInfo.latestUpdate,
      latestUpdateAt: row.techInfo.latestUpdateAt,
    },
    blockers: row.blockers.map((b) => ({
      id: b.id,
      description: b.description,
      resolvedAt: b.resolvedAt,
      createdByName: b.createdBy.name,
      createdAt: b.createdAt,
    })),
    milestones: row.milestones.map((m) => ({
      id: m.id,
      name: m.name,
      date: m.date,
      doneAt: m.doneAt,
    })),
    terms: row.terms.map((t) => ({
      id: t.id,
      sequence: t.sequence,
      name: t.name,
      percentage: Number(t.percentage),
      amount: Number(t.amount),
      dueDate: t.dueDate,
      dueNote: t.dueNote,
      step: t.step as TermStep,
      feedback: t.feedback,
      invoiceRequestUrl: t.invoiceRequestUrl,
      approvedInvoiceUrl: t.approvedInvoiceUrl,
      transferProofUrl: t.transferProofUrl,
      receiptUrl: t.receiptUrl,
      completedAt: t.completedAt,
      updatedAt: t.updatedAt,
    })),
    handover: row.handover && {
      uatStatus: row.handover.uatStatus,
      warrantyStart: row.handover.warrantyStart,
      warrantyEnd: row.handover.warrantyEnd,
    },
    disbursement: row.disbursement && {
      status: row.disbursement.status,
      feedback: row.disbursement.feedback,
      submittedAt: row.disbursement.submittedAt,
      verifiedAt: row.disbursement.verifiedAt,
      decidedAt: row.disbursement.decidedAt,
      decidedByName: row.disbursement.decidedById
        ? (names.get(row.disbursement.decidedById) ?? null)
        : null,
      disbursedAt: row.disbursement.disbursedAt,
    },
    stageDeadlines,
    stageCompletedAt,
  };
}

export async function snapshotsFrom(
  rows: ProjectRow[],
): Promise<ProjectSnapshot[]> {
  const names = await namesFor(
    rows.flatMap((row) => [
      row.staffing?.assignedById,
      row.disbursement?.decidedById,
    ]),
  );
  return rows.map((row) => toSnapshot(row, names));
}

/** Memuat potret satu project dari Project ID (IIT-2627-014) atau id internal. */
export async function loadSnapshot(
  codeOrId: string,
  client: Tx | typeof prisma = prisma,
): Promise<ProjectSnapshot | null> {
  const row = await client.project.findFirst({
    where: { OR: [{ code: codeOrId }, { id: codeOrId }], deletedAt: null },
    include: SNAPSHOT_INCLUDE,
  });
  if (!row) return null;
  const [snapshot] = await snapshotsFrom([row]);
  return snapshot;
}

/**
 * Siapa yang memegang hak edit. Penugasan yang orangnya sudah tidak memegang
 * jabatan yang sesuai tidak lagi memberi hak edit, meskipun barisnya masih
 * ada sampai C-Level mengganti orangnya.
 */
export function accessOf(project: ProjectSnapshot): ProjectAccess {
  const valid = <T extends { userActive: boolean }>(a: T | null) =>
    a?.userActive ? a : null;
  return {
    closed: Boolean(project.closedAt),
    pmUserId: valid(pmOf(project))?.userId ?? null,
    developerUserIds: developersOf(project)
      .filter((d) => d.userActive)
      .map((d) => d.userId),
    financePocUserId: valid(financePocOf(project))?.userId ?? null,
    mouSigned: Boolean(documentOf(project, "MOU")?.signedAt),
  };
}

/**
 * Mencatat permanen stage yang baru memenuhi syaratnya, lalu memberi tahu PM
 * bahwa stage berikutnya terbuka (PRD bab 11). Aman dipanggil berulang.
 */
export async function syncStageCompletion(
  tx: Tx,
  project: ProjectSnapshot,
  actorId: string | null,
  now: Date = new Date(),
): Promise<StageState[]> {
  let current = project;
  let stages = deriveStages(current, now);

  // Satu perubahan bisa menyelesaikan beberapa stage berturut-turut, dan
  // stage yang tercatat selesai bisa membuka stage berikutnya.
  for (let round = 0; round < 9; round++) {
    const fresh = newlyCompletedStages(current, stages);
    if (fresh.length === 0) break;

    for (const stage of fresh) {
      const completedAt = stage.completedAt ?? now;
      // Hanya yang berhasil mengisi `completedAt` yang mencatat riwayat, supaya
      // dua permintaan bersamaan tidak menulis "stage selesai" dua kali.
      const updated = await tx.projectStage.updateMany({
        where: { projectId: project.id, stage: stage.n, completedAt: null },
        data: { completedAt },
      });
      let claimed = updated.count > 0;
      if (!claimed) {
        const created = await tx.projectStage.createMany({
          data: [{ projectId: project.id, stage: stage.n, completedAt }],
          skipDuplicates: true,
        });
        claimed = created.count > 0;
      }
      if (!claimed) continue;

      const def = stageDefinition(stage.n);
      await recordActivity(tx, {
        projectId: project.id,
        actorId,
        action: "stage.completed",
        summary: `Stage ${def.n} ${def.name} selesai`,
        stage: def.n,
        result: "APPROVED",
      });

      if (stage.n < 9) {
        const next = stageDefinition(stage.n + 1);
        await notify(tx, {
          userIds: [pmOf(project)?.userId],
          message: `${next.name} Project ${project.name} telah dibuka.`,
          href: projectHref(project.code, { stage: next.n }),
        });
      }
    }

    current = {
      ...current,
      stageCompletedAt: {
        ...current.stageCompletedAt,
        ...Object.fromEntries(fresh.map((s) => [s.n, s.completedAt ?? now])),
      },
    };
    stages = deriveStages(current, now);
  }

  return stages;
}
