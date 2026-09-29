import { z } from "zod";
import { canOnProject, type ProjectAction } from "@/lib/auth/access";
import type { Actor, RoleName } from "@/lib/auth/types";
import { checkTermScheme } from "@/lib/finance/terms";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENTS,
  type DocumentKind,
  type DocumentStatus,
} from "@/lib/project/catalog";
import {
  developersOf,
  documentOf,
  latestSubmission,
  pmOf,
  type SubmissionKind,
  type SubmissionSnapshot,
} from "@/lib/project/snapshot";
import { parseDateInput } from "@/lib/time";
import { feedbackSchema, isValidLink } from "@/lib/validation";
import { recordActivity } from "@/server/activity";
import { prisma } from "@/server/db";
import {
  notify,
  notifyApprovers,
  notifyRoles,
  projectHref,
} from "@/server/notify";
import {
  ActionError,
  type MutationContext,
  mutateProject,
  parseInput,
  requireStageOpen,
} from "./mutate";

/** Aksi izin yang membuka pengeditan tiap jenis dokumen (PRD bab 2.4). */
const EDIT_ACTION: Record<DocumentKind, ProjectAction> = {
  REQUIREMENT_GATHERING: "stage1.edit",
  PROJECT_CHARTER: "charter.edit",
  GANTT_CHART: "charter.edit",
  MOU: "mou.edit",
  PROGRAMMER_CONTRACT: "contract.edit",
  PROGRESS_REPORT: "ops.edit",
  TESTING_RESULT: "ops.edit",
  BAST: "ops.edit",
  CLIENT_FEEDBACK: "ops.edit",
  PROGRAMMER_FEEDBACK: "ops.edit",
  PROJECT_DOCUMENTATION: "ops.edit",
  SOURCE_CODE_DOCUMENTATION: "ops.edit",
};

/** Dokumen yang cukup ditautkan untuk dianggap lengkap. */
const DONE_WHEN_LINKED: readonly DocumentKind[] = [
  "CLIENT_FEEDBACK",
  "PROGRAMMER_FEEDBACK",
  "PROJECT_DOCUMENTATION",
  "SOURCE_CODE_DOCUMENTATION",
  "PROGRESS_REPORT",
  "TESTING_RESULT",
];

const SUBMITTABLE: Partial<Record<DocumentKind, SubmissionKind>> = {
  PROJECT_CHARTER: "PROJECT_CHARTER",
  MOU: "MOU",
  PROGRAMMER_CONTRACT: "PROGRAMMER_CONTRACT",
};

const APPROVERS: Record<
  SubmissionKind,
  { roles: RoleName[]; label: string; decide: ProjectAction }
> = {
  PROJECT_CHARTER: {
    roles: ["COO", "VICE_COO"],
    label: "Project Charter",
    decide: "charter.decide",
  },
  MOU: { roles: ["COO", "VICE_COO"], label: "MoU", decide: "mou.decide" },
  PROGRAMMER_CONTRACT: {
    roles: ["CTO", "VICE_CTO"],
    label: "Kontrak Programmer",
    decide: "contract.decide",
  },
};

const TAB_OF_STAGE: Record<number, "pm" | "tech" | "finance"> = {
  1: "pm",
  2: "pm",
  3: "pm",
  4: "tech",
  5: "finance",
  6: "tech",
  7: "pm",
  8: "pm",
  9: "pm",
};

function documentLabel(kind: DocumentKind, developerName?: string): string {
  const name = DOCUMENTS[kind].name;
  return developerName ? `${name} ${developerName}` : name;
}

function developerName(
  context: MutationContext,
  developerId: string,
): string | undefined {
  if (!developerId) return undefined;
  return developersOf(context.project).find((d) => d.userId === developerId)
    ?.name;
}

function assertDeveloper(
  context: MutationContext,
  kind: DocumentKind,
  developerId: string,
) {
  if (kind === "PROGRAMMER_CONTRACT") {
    if (!developersOf(context.project).some((d) => d.userId === developerId)) {
      throw new ActionError(
        "Kontrak Programmer hanya untuk developer yang sedang ditugaskan.",
      );
    }
  } else if (developerId) {
    throw new ActionError("Dokumen ini tidak terikat ke developer.");
  }
}

/**
 * Semantik patch: kolom yang tidak dikirim tidak diubah. `url` atau `deadline`
 * berupa string kosong berarti dihapus.
 */
const saveDocumentSchema = z.object({
  kind: z.enum(Object.keys(DOCUMENTS) as [DocumentKind, ...DocumentKind[]]),
  developerId: z.string().default(""),
  url: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => value === undefined || value === "" || isValidLink(value),
      "Tautan harus berupa URL valid, diawali https://.",
    ),
  status: z.enum(["MISSING", "IN_PROGRESS", "SUBMITTED", "DONE"]).optional(),
  deadline: z.string().trim().optional(),
});

export type SaveDocumentInput = z.input<typeof saveDocumentSchema>;

/**
 * Tambah Link, Ganti Link, ubah status, atau atur tenggat sebuah dokumen.
 * Selama pengajuan menunggu, isian terkunci (PRD bab 6).
 */
export async function saveDocument(params: {
  actor: Actor;
  projectId: string;
  input: SaveDocumentInput;
}): Promise<void> {
  const input = parseInput(saveDocumentSchema, params.input);
  const def = DOCUMENTS[input.kind];

  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: EDIT_ACTION[input.kind],
    run: async (context) => {
      const { tx, project, stages } = context;
      requireStageOpen(stages, def.stage);
      assertDeveloper(context, input.kind, input.developerId);

      const existing = documentOf(project, input.kind, input.developerId);
      const latest = latestSubmission(project, existing?.id);
      if (latest?.status === "PENDING") {
        throw new ActionError(
          `${def.name} sedang menunggu persetujuan, jadi isiannya terkunci.`,
        );
      }
      // Setelah disetujui, dokumen tidak diubah lagi tanpa pengajuan baru.
      // MoU pengecualian: PM mengganti tautannya dengan versi bertanda tangan
      // sebelum menandai ditandatangani (PRD bab 4.6).
      if (latest?.status === "APPROVED" && input.kind !== "MOU") {
        throw new ActionError(
          `${def.name} sudah disetujui dan tidak bisa diubah lagi.`,
        );
      }
      if (existing?.signedAt && input.kind !== "BAST") {
        throw new ActionError(
          `${def.name} sudah ditandatangani dan tidak bisa diubah lagi.`,
        );
      }

      const url =
        input.url === undefined ? (existing?.url ?? null) : input.url || null;
      const deadline =
        input.deadline === undefined
          ? (existing?.deadline ?? null)
          : parseDateInput(input.deadline);
      if (input.deadline && !deadline) {
        throw new ActionError("Tenggat tidak valid.");
      }

      let status: DocumentStatus =
        input.status ?? existing?.status ?? "MISSING";
      if (status === "SUBMITTED") {
        // "Diajukan" diatur lewat pengajuan, bukan dipilih manual, untuk
        // dokumen yang punya approver.
        if (SUBMITTABLE[input.kind]) status = existing?.status ?? "IN_PROGRESS";
      }
      if (!url) status = status === "DONE" ? "IN_PROGRESS" : status;
      if (url && status === "MISSING") status = "IN_PROGRESS";
      if (url && DONE_WHEN_LINKED.includes(input.kind)) status = "DONE";
      if (!url && DONE_WHEN_LINKED.includes(input.kind)) status = "MISSING";

      const data = {
        url,
        status,
        deadline,
        updatedById: params.actor.userId,
      };
      await tx.document.upsert({
        where: {
          projectId_kind_developerId: {
            projectId: project.id,
            kind: input.kind,
            developerId: input.developerId,
          },
        },
        create: {
          projectId: project.id,
          kind: input.kind,
          developerId: input.developerId,
          ownerId: pmOf(project)?.userId ?? params.actor.userId,
          ...data,
        },
        update: data,
      });

      const label = documentLabel(
        input.kind,
        developerName(context, input.developerId),
      );
      const changes: string[] = [];
      if (url !== (existing?.url ?? null)) {
        changes.push(
          existing?.url
            ? `Mengganti tautan ${label}`
            : `Menambahkan tautan ${label}`,
        );
      }
      if (existing && status !== existing.status) {
        changes.push(
          `Mengubah status ${label} menjadi ${DOCUMENT_STATUS_LABELS[status]}`,
        );
      }
      if (
        (deadline?.getTime() ?? null) !==
        (existing?.deadline?.getTime() ?? null)
      ) {
        changes.push(`Mengatur tenggat ${label}`);
      }
      if (changes.length > 0) {
        await recordActivity(tx, {
          projectId: project.id,
          actorId: params.actor.userId,
          action: "document.updated",
          summary: changes.join("; "),
          stage: def.stage,
          objectType: "document",
          objectId: input.kind,
          data: { url, status },
        });
      }
    },
  });
}

/** Tandai Selesai pada Stage 1 (PRD bab 4.4). */
export async function completeStage1(params: {
  actor: Actor;
  projectId: string;
}): Promise<void> {
  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "stage1.edit",
    run: async ({ tx, project, now }) => {
      if (project.stage1DoneAt)
        throw new ActionError("Stage 1 sudah ditandai selesai.");
      const doc = documentOf(project, "REQUIREMENT_GATHERING");
      if (!doc?.url) {
        throw new ActionError(
          "Tautkan Requirement Gathering Document terlebih dahulu sebelum menandai Stage 1 selesai.",
        );
      }
      await tx.document.update({
        where: { id: doc.id },
        data: { status: "DONE", updatedById: params.actor.userId },
      });
      await tx.project.update({
        where: { id: project.id },
        data: { stage1DoneAt: now },
      });
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "stage1.completed",
        summary: "Menandai Requirement Gathering selesai",
        stage: 1,
        result: "APPROVED",
      });
    },
  });
}

/**
 * Ajukan untuk Persetujuan / Ajukan Ulang (PRD bab 6). Pengaju tidak memilih
 * approver; sistem menentukannya dari jenis pengajuan.
 */
export async function submitDocument(params: {
  actor: Actor;
  projectId: string;
  kind: DocumentKind;
  developerId?: string;
}): Promise<void> {
  const submissionKind = SUBMITTABLE[params.kind];
  if (!submissionKind)
    throw new ActionError("Dokumen ini tidak memerlukan persetujuan.");
  const developerId = params.developerId ?? "";
  const approver = APPROVERS[submissionKind];
  const def = DOCUMENTS[params.kind];

  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: EDIT_ACTION[params.kind],
    run: async (context) => {
      const { tx, project, stages, now } = context;
      requireStageOpen(stages, def.stage);
      assertDeveloper(context, params.kind, developerId);

      const doc = documentOf(project, params.kind, developerId);
      if (!doc?.url) {
        throw new ActionError(
          `Tautkan ${def.name} terlebih dahulu sebelum mengajukan.`,
        );
      }
      const last = latestSubmission(project, doc.id);
      if (last?.status === "PENDING") {
        throw new ActionError(
          `${def.name} sudah diajukan dan sedang menunggu persetujuan.`,
        );
      }
      if (last?.status === "APPROVED") {
        throw new ActionError(`${def.name} sudah disetujui.`);
      }
      if (params.kind === "MOU") {
        if (project.terms.length === 0) {
          throw new ActionError(
            "Isi termin pembayaran terlebih dahulu sebelum mengajukan MoU.",
          );
        }
        const check = checkTermScheme(project.terms);
        if (!check.valid) throw new ActionError(check.errors[0]);
      }

      await tx.submission.create({
        data: {
          projectId: project.id,
          kind: submissionKind,
          documentId: doc.id,
          submittedById: params.actor.userId,
          submittedAt: now,
        },
      });
      await tx.document.update({
        where: { id: doc.id },
        data: { status: "SUBMITTED", updatedById: params.actor.userId },
      });

      const label = documentLabel(
        params.kind,
        developerName(context, developerId),
      );
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "submission.submitted",
        summary:
          last?.status === "REJECTED"
            ? `Mengajukan ulang ${label} untuk persetujuan`
            : `Mengajukan ${label} untuk persetujuan`,
        stage: def.stage,
        result: "SUBMITTED",
        objectType: "document",
        objectId: doc.id,
      });
      const waitingMessage = {
        message: `${approver.label} Project ${project.name} menunggu persetujuan Anda.`,
        href: projectHref(project.code, {
          stage: def.stage,
          tab: TAB_OF_STAGE[def.stage],
        }),
      };
      await notifyApprovers(
        tx,
        context.access.approvers?.[submissionKind]?.userIds,
        approver.roles,
        waitingMessage,
      );
      // Project Charter juga menunggu sisi Tech (CTO/VCTO).
      if (submissionKind === "PROJECT_CHARTER") {
        await notifyApprovers(
          tx,
          context.access.approvers?.CHARTER_TECH?.userIds,
          ["CTO", "VICE_CTO"],
          waitingMessage,
        );
      }
    },
  });
}

const decisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVE") }),
  z.object({ decision: z.literal("REJECT"), feedback: feedbackSchema }),
]);

/**
 * Setujui atau Tolak. Keputusan pertama yang masuk yang berlaku: baris hanya
 * diperbarui selama masih PENDING (PRD bab 2.3).
 */
export async function decideSubmission(params: {
  actor: Actor;
  projectId: string;
  submissionId: string;
  decision: "APPROVE" | "REJECT";
  feedback?: string;
}): Promise<void> {
  const decision = parseInput(decisionSchema, {
    decision: params.decision,
    feedback: params.feedback,
  });

  // Aksi izin bergantung pada jenis pengajuan, jadi jenisnya dibaca dulu.
  const submission = await prisma.submission.findUnique({
    where: { id: params.submissionId },
    select: { kind: true, projectId: true },
  });
  if (!submission) throw new ActionError("Pengajuan tidak ditemukan.");
  const approver = APPROVERS[submission.kind];

  const charter = submission.kind === "PROJECT_CHARTER";

  await mutateProject({
    actor: params.actor,
    projectId: submission.projectId,
    // Project Charter: cukup salah satu sisi yang boleh (COO/VCOO atau CTO/VCTO).
    action: charter
      ? ["charter.decide", "charter.decideTech"]
      : approver.decide,
    run: async (context) => {
      const { tx, project, now } = context;
      const target = project.submissions.find(
        (s) => s.id === params.submissionId,
      );
      if (!target || project.id !== submission.projectId) {
        throw new ActionError("Pengajuan tidak ditemukan.");
      }

      const approved = decision.decision === "APPROVE";
      const doc = project.documents.find((d) => d.id === target.documentId);
      const devName = doc ? developerName(context, doc.developerId) : undefined;
      const label = devName ? `${approver.label} ${devName}` : approver.label;
      const stage = doc ? DOCUMENTS[doc.kind].stage : undefined;
      const href = projectHref(project.code, {
        stage,
        tab: stage ? TAB_OF_STAGE[stage] : undefined,
      });

      if (charter && approved) {
        const finished = await approveCharterSide(context, target, label);
        if (!finished) return;
      } else {
        const updated = await tx.submission.updateMany({
          where: { id: target.id, status: "PENDING" },
          data: {
            status: approved ? "APPROVED" : "REJECTED",
            decidedById: params.actor.userId,
            decidedAt: now,
            feedback: approved ? null : decision.feedback,
          },
        });
        if (updated.count === 0) {
          const verb = target.status === "APPROVED" ? "Disetujui" : "Ditolak";
          throw new ActionError(
            `Pengajuan ini sudah diputuskan. ${verb} oleh ${target.decidedByName ?? "approver lain"}.`,
          );
        }
      }

      if (doc) {
        await tx.document.update({
          where: { id: doc.id },
          data: { status: approved ? "DONE" : "IN_PROGRESS" },
        });
      }

      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: approved ? "submission.approved" : "submission.rejected",
        summary: approved
          ? charter
            ? `Menyetujui ${label}; kedua sisi sudah setuju`
            : `Menyetujui ${label}`
          : `Menolak pengajuan ${label}`,
        stage,
        result: approved ? "APPROVED" : "REJECTED",
        feedback: approved ? null : decision.feedback,
        objectType: "submission",
        objectId: target.id,
      });
      await notify(tx, {
        userIds: [target.submittedById, pmOf(project)?.userId],
        message: `${label} Project ${project.name} ${approved ? "disetujui" : "ditolak"}.`,
        href,
      });
    },
  });
}

/**
 * Catat persetujuan satu sisi Project Charter, lalu tutup pengajuannya bila
 * sisi lain sudah setuju. Mengembalikan `true` bila pengajuan kini APPROVED.
 *
 * Aman dari dua approver yang menekan bersamaan: UPDATE pertama mengunci baris,
 * sehingga transaksi kedua menunggu, lalu membaca ulang baris yang sudah terisi
 * dan menjadi yang menutup pengajuan.
 */
async function approveCharterSide(
  context: MutationContext,
  target: SubmissionSnapshot,
  label: string,
): Promise<boolean> {
  const { tx, project, viewer, access, actor, now } = context;
  const canOps = canOnProject(viewer, "charter.decide", access).allowed;
  const canTech = canOnProject(viewer, "charter.decideTech", access).allowed;
  const side =
    canOps && !target.opsApprovedAt
      ? "ops"
      : canTech && !target.techApprovedAt
        ? "tech"
        : null;
  if (!side) {
    throw new ActionError(
      target.status === "PENDING"
        ? `Sisi ${canOps ? "COO / Vice COO" : "CTO / Vice CTO"} sudah menyetujui. Menunggu sisi ${canOps ? "CTO / Vice CTO" : "COO / Vice COO"}.`
        : `Pengajuan ini sudah diputuskan oleh ${target.decidedByName ?? "approver lain"}.`,
    );
  }
  const sideLabel = side === "ops" ? "COO / Vice COO" : "CTO / Vice CTO";

  const claimed = await tx.submission.updateMany({
    where:
      side === "ops"
        ? { id: target.id, status: "PENDING", opsApprovedAt: null }
        : { id: target.id, status: "PENDING", techApprovedAt: null },
    data:
      side === "ops"
        ? { opsApprovedAt: now, opsApprovedById: actor.userId }
        : { techApprovedAt: now, techApprovedById: actor.userId },
  });
  if (claimed.count === 0) {
    throw new ActionError(
      `Pengajuan ini sudah diputuskan, atau sisi ${sideLabel} sudah menyetujui. Muat ulang halaman.`,
    );
  }

  const fresh = await tx.submission.findUniqueOrThrow({
    where: { id: target.id },
    select: { opsApprovedAt: true, techApprovedAt: true },
  });
  if (fresh.opsApprovedAt && fresh.techApprovedAt) {
    await tx.submission.updateMany({
      where: { id: target.id, status: "PENDING" },
      data: { status: "APPROVED", decidedById: actor.userId, decidedAt: now },
    });
    return true;
  }

  const other = side === "ops" ? "CTO / Vice CTO" : "COO / Vice COO";
  await recordActivity(tx, {
    projectId: project.id,
    actorId: actor.userId,
    action: "submission.approved_partial",
    summary: `Menyetujui ${label} sebagai ${sideLabel}; menunggu ${other}`,
    stage: 2,
    result: "UPDATED",
    objectType: "submission",
    objectId: target.id,
  });
  await notify(tx, {
    userIds: [target.submittedById, pmOf(project)?.userId],
    message: `${label} Project ${project.name} disetujui ${sideLabel}, menunggu ${other}.`,
    href: projectHref(project.code, { stage: 2, tab: "pm" }),
    exceptUserId: actor.userId,
  });
  return false;
}

const SIGNABLE = ["MOU", "PROGRAMMER_CONTRACT", "BAST"] as const;
type Signable = (typeof SIGNABLE)[number];

/** Tandai Ditandatangani untuk MoU, Kontrak Programmer, dan BAST. */
export async function markSigned(params: {
  actor: Actor;
  projectId: string;
  kind: Signable;
  developerId?: string;
}): Promise<void> {
  if (!SIGNABLE.includes(params.kind))
    throw new ActionError("Dokumen ini tidak ditandatangani.");
  const developerId = params.developerId ?? "";
  const def = DOCUMENTS[params.kind];

  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: EDIT_ACTION[params.kind],
    run: async (context) => {
      const { tx, project, stages, now } = context;
      requireStageOpen(stages, def.stage);
      assertDeveloper(context, params.kind, developerId);
      const doc = documentOf(project, params.kind, developerId);
      if (!doc?.url)
        throw new ActionError(`Tautkan ${def.name} terlebih dahulu.`);
      if (doc.signedAt)
        throw new ActionError(`${def.name} sudah ditandai ditandatangani.`);
      if (
        params.kind !== "BAST" &&
        latestSubmission(project, doc.id)?.status !== "APPROVED"
      ) {
        throw new ActionError(
          `${def.name} harus disetujui dulu sebelum ditandai ditandatangani.`,
        );
      }

      await tx.document.update({
        where: { id: doc.id },
        data: {
          signedAt: now,
          status: "DONE",
          updatedById: params.actor.userId,
        },
      });
      const label = documentLabel(
        params.kind,
        developerName(context, developerId),
      );
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "document.signed",
        summary: `Menandai ${label} ditandatangani`,
        stage: def.stage,
        result: "APPROVED",
      });

      if (params.kind === "MOU") {
        await notifyRoles(tx, ["CFO", "VICE_CFO"], {
          message: `Project ${project.name} siap ditunjuk Finance POC.`,
          href: projectHref(project.code, { tab: "finance" }),
        });
      }
    },
  });
}
