import { AUDIT_OBJECTS } from "@/lib/audit/actions";
import { activeAssignments } from "@/lib/auth/period";
import { checkPermission } from "@/lib/auth/permissions";
import type { Actor, Division } from "@/lib/auth/types";
import type { ReferenceKind } from "@/lib/project/external-reference";
import type { StageDefinition } from "@/lib/project/stages";
import { findStage, STAGE_CATALOGUE } from "@/lib/project/stages";
import { prisma } from "@/server/db";

/**
 * Pengambilan isi halaman project (F08-T03).
 *
 * Seluruh isi Project Hub diambil dalam satu permintaan bersarang, bukan
 * belasan permintaan terpisah. Halaman ini dibuka berkali-kali setiap hari, dan
 * PRD bab 5 menetapkan daftar project harus tampil di bawah tiga detik pada
 * seratus project.
 */

/** Bagian klien Prisma yang dipakai di sini, supaya test bisa menyuntikkan penghitung. */
export type ProjectReader = Pick<typeof prisma, "project">;

/**
 * Divisi tempat seseorang berhak mengubah data sebuah project.
 *
 * Sengaja bekerja dari baris yang sudah terambil, bukan dari basis data, supaya
 * halaman ini tetap satu permintaan. Aturannya sama dengan projectContextFor:
 * penugasan hanya berlaku selama jabatannya masih berlaku.
 */
function divisionsFor(
  actor: Actor,
  now: Date,
  assignedPmId: string | null,
  assignments: ReadonlyArray<{ division: string; userId: string }>,
): Division[] {
  const stillServingIn = new Set(
    activeAssignments(actor.roleAssignments, now).map((a) => a.division),
  );

  const divisions = new Set<Division>();

  if (assignedPmId === actor.userId && stillServingIn.has("OPERATIONAL")) {
    divisions.add("OPERATIONAL");
  }

  for (const assignment of assignments) {
    if (assignment.userId !== actor.userId) continue;
    const division = assignment.division as Division;
    if (stillServingIn.has(division)) divisions.add(division);
  }

  return [...divisions];
}

export interface ProjectHubData {
  id: string;
  projectId: string;
  name: string;
  clientName: string;
  status: string;
  /** Kosong bila jabatan pengguna tidak mengizinkan melihat nilai project. */
  value: string | null;
  stage: { key: string; label: string } | null;
  assignedPm: { id: string; name: string } | null;
  clientConfirmedAt: Date | null;
  pmAssignedAt: Date | null;
  updatedAt: Date;
  members: Array<{
    assignmentId: string;
    userId: string;
    name: string;
    division: string;
  }>;
  stageHistory: Array<{
    fromStage: string | null;
    toStage: string;
    changedBy: string;
    note: string | null;
    changedAt: Date;
  }>;
  references: Array<{ kind: ReferenceKind; url: string; label: string }>;
  staffingRequests: Array<{
    id: string;
    roleNeeded: string;
    headcount: number;
    status: string;
    requestedAt: Date;
    fulfilledAt: Date | null;
    fulfilledByName: string | null;
  }>;
  pendingSubmissions: Array<{
    id: string;
    type: string;
    currentStepOrder: number | null;
    createdAt: Date;
  }>;
}

/**
 * Seluruh isi halaman sebuah project.
 *
 * Mengembalikan `null` bila projectnya tidak ada atau pengguna tidak berhak
 * melihatnya sama sekali. Nilai project disaring terpisah, karena yang tidak
 * boleh melihat nilai tetap boleh melihat sisanya (F08-AC2).
 */
export async function readProjectHub(
  actor: Actor,
  projectDbId: string,
  now: Date = new Date(),
  reader: ProjectReader = prisma,
  catalogue: readonly StageDefinition[] = STAGE_CATALOGUE,
): Promise<ProjectHubData | null> {
  const project = await reader.project.findUnique({
    where: { id: projectDbId },
    select: {
      id: true,
      projectId: true,
      name: true,
      clientName: true,
      status: true,
      value: true,
      stage: true,
      clientConfirmedAt: true,
      pmAssignedAt: true,
      updatedAt: true,
      assignedPmId: true,
      assignedPm: { select: { id: true, name: true } },
      assignments: {
        where: { endedAt: null },
        select: {
          id: true,
          division: true,
          userId: true,
          user: { select: { name: true } },
        },
      },
      stageHistory: {
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          fromStage: true,
          toStage: true,
          note: true,
          createdAt: true,
          changedBy: { select: { name: true } },
        },
      },
      references: {
        orderBy: { createdAt: "asc" },
        select: { kind: true, url: true, label: true },
      },
      staffingRequests: {
        orderBy: { requestedAt: "desc" },
        select: {
          id: true,
          roleNeeded: true,
          headcount: true,
          status: true,
          requestedAt: true,
          fulfilledAt: true,
          fulfilledBy: { select: { name: true } },
        },
      },
      submissions: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          type: true,
          currentStepOrder: true,
          createdAt: true,
        },
      },
    },
  });

  if (!project) return null;

  // Konteks izin disusun dari data yang sudah terambil di atas. Memanggil
  // projectContextFor di sini akan menambah satu permintaan lagi, dan itu
  // justru yang dihindari task ini.
  const konteks = {
    projectId: project.id,
    assignedDivisions: divisionsFor(
      actor,
      now,
      project.assignedPmId,
      project.assignments,
    ),
  };

  if (
    !checkPermission({ actor, action: "project.view", project: konteks, now })
      .allowed
  ) {
    return null;
  }

  const bolehLihatNilai = checkPermission({
    actor,
    action: "project.view_value",
    project: konteks,
    now,
  }).allowed;

  const stage = project.stage
    ? {
        key: project.stage,
        label: findStage(catalogue, project.stage)?.label ?? project.stage,
      }
    : null;

  return {
    id: project.id,
    projectId: project.projectId,
    name: project.name,
    clientName: project.clientName,
    status: project.status,
    value: bolehLihatNilai ? (project.value?.toString() ?? null) : null,
    stage,
    assignedPm: project.assignedPm,
    clientConfirmedAt: project.clientConfirmedAt,
    pmAssignedAt: project.pmAssignedAt,
    updatedAt: project.updatedAt,
    members: project.assignments.map((a) => ({
      assignmentId: a.id,
      userId: a.userId,
      name: a.user.name,
      division: a.division,
    })),
    stageHistory: project.stageHistory.map((h) => ({
      fromStage: h.fromStage,
      toStage: h.toStage,
      changedBy: h.changedBy.name,
      note: h.note,
      changedAt: h.createdAt,
    })),
    references: project.references.map((r) => ({
      kind: r.kind as ReferenceKind,
      url: r.url,
      label: r.label,
    })),
    staffingRequests: project.staffingRequests.map((row) => ({
      id: row.id,
      roleNeeded: row.roleNeeded,
      headcount: row.headcount,
      status: row.status,
      requestedAt: row.requestedAt,
      fulfilledAt: row.fulfilledAt,
      fulfilledByName: row.fulfilledBy?.name ?? null,
    })),
    pendingSubmissions: project.submissions,
  };
}

export interface ProjectListRow {
  id: string;
  projectId: string;
  name: string;
  clientName: string;
  assignedPm: string | null;
  stage: string | null;
  /** Kosong bila jabatan pengguna tidak mengizinkan melihat nilai project. */
  value: string | null;
  updatedAt: Date;
}

/**
 * Daftar project untuk halaman utama.
 *
 * Satu permintaan untuk seluruh daftar. Nilai project disaring per baris
 * berdasarkan penugasan, karena PM boleh melihat nilai project yang
 * ditugaskan kepadanya tetapi tidak project orang lain.
 */
export async function readProjectList(
  actor: Actor,
  now: Date = new Date(),
  reader: ProjectReader = prisma,
  catalogue: readonly StageDefinition[] = STAGE_CATALOGUE,
): Promise<ProjectListRow[]> {
  const rows = await reader.project.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      projectId: true,
      name: true,
      clientName: true,
      stage: true,
      value: true,
      updatedAt: true,
      assignedPmId: true,
      assignedPm: { select: { name: true } },
      assignments: {
        where: { endedAt: null, userId: actor.userId },
        select: { division: true },
      },
    },
  });

  return rows.map((row) => {
    const assignedDivisions = divisionsFor(
      actor,
      now,
      row.assignedPmId,
      row.assignments.map((a) => ({ ...a, userId: actor.userId })),
    );

    const bolehLihatNilai = checkPermission({
      actor,
      action: "project.view_value",
      project: { projectId: row.id, assignedDivisions },
      now,
    }).allowed;

    return {
      id: row.id,
      projectId: row.projectId,
      name: row.name,
      clientName: row.clientName,
      assignedPm: row.assignedPm?.name ?? null,
      stage: row.stage
        ? (findStage(catalogue, row.stage)?.label ?? row.stage)
        : null,
      value: bolehLihatNilai ? (row.value?.toString() ?? null) : null,
      updatedAt: row.updatedAt,
    };
  });
}

/**
 * Isi halaman hub untuk rute `/projects/[projectId]` (nomor resmi IIT-…).
 *
 * `readProjectHub` memakai id basis data dan menjaga satu permintaan bersarang.
 * Halaman UI masih butuh periode, nama pendaftar, dan jejak audit — itu diambil
 * di sini supaya F08-T03 tidak pecah.
 */
export type ProjectHubPageData = ProjectHubData & {
  period: string;
  registeredByName: string;
  assignedPmName: string | null;
  knownStages: Array<{ key: string; order: number; label: string }>;
  /** Nilai project untuk form termin, ditapis izin yang sama dengan `value`. */
  schemeValue: string | null;
  /**
   * Nilai projectnya ada, tetapi pembaca ini tidak boleh melihatnya. Membedakan
   * "belum diisi" dari "tidak boleh dilihat", tanpa menyebut angkanya.
   */
  valueHidden: boolean;
  auditTrail: Array<{
    action: string;
    actorName: string | null;
    reason: string | null;
    createdAt: Date;
    before: unknown;
    after: unknown;
  }>;
  termins: Array<{
    id: string;
    sequence: number;
    percentage: string;
    amount: string;
    dueDate: Date;
    status: string;
  }>;
};

export async function getProjectHubByProjectId(
  actor: Actor,
  projectId: string,
  now: Date = new Date(),
): Promise<ProjectHubPageData | null> {
  const found = await prisma.project.findUnique({
    where: { projectId },
    select: {
      id: true,
      period: true,
      registeredBy: { select: { name: true } },
      submissions: { select: { id: true } },
      staffingRequests: { select: { id: true } },
      value: true,
    },
  });
  if (!found) return null;

  const hub = await readProjectHub(actor, found.id, now);
  if (!hub) return null;

  const submissionIds = found.submissions.map((row) => row.id);
  const staffingIds = found.staffingRequests.map((row) => row.id);
  const objectFilters = [
    { objectType: AUDIT_OBJECTS.PROJECT, objectId: found.id },
    ...(submissionIds.length > 0
      ? [
          {
            objectType: AUDIT_OBJECTS.SUBMISSION,
            objectId: { in: submissionIds },
          },
        ]
      : []),
    ...(staffingIds.length > 0
      ? [
          {
            objectType: AUDIT_OBJECTS.STAFFING_REQUEST,
            objectId: { in: staffingIds },
          },
        ]
      : []),
  ];

  const termins = await prisma.termin.findMany({
    where: { projectId: found.id },
    orderBy: { sequence: "asc" },
    select: {
      id: true,
      sequence: true,
      percentage: true,
      amount: true,
      dueDate: true,
      status: true,
    },
  });

  const auditTrail = await prisma.auditLog.findMany({
    where: { OR: objectFilters },
    orderBy: { createdAt: "desc" },
    take: 40,
    select: {
      action: true,
      reason: true,
      createdAt: true,
      before: true,
      after: true,
      actor: { select: { name: true } },
    },
  });

  return {
    ...hub,
    period: found.period,
    registeredByName: found.registeredBy.name,
    assignedPmName: hub.assignedPm?.name ?? null,
    knownStages: STAGE_CATALOGUE.map((stage) => ({
      key: stage.key,
      order: stage.order,
      label: stage.label,
    })),
    // Mengikuti `hub.value`, yang sudah ditapis project.view_value. Sebelumnya
    // nilai ini dikirim apa adanya sebagai bahan hitung formulir termin,
    // sehingga jabatan yang boleh mengubah termin tetapi tidak boleh melihat
    // nilai project, yaitu Officer Operational yang ditugaskan, ikut
    // menerimanya. Menyalin dari hub.value, bukan memeriksa izin sekali lagi,
    // supaya penapisannya tidak bisa berbeda dengan yang dipakai `value`.
    schemeValue: hub.value,
    valueHidden: found.value !== null && hub.value === null,
    auditTrail: auditTrail.map((row) => ({
      action: row.action,
      actorName: row.actor?.name ?? null,
      reason: row.reason,
      createdAt: row.createdAt,
      before: row.before,
      after: row.after,
    })),
    termins: termins.map((row) => ({
      id: row.id,
      sequence: row.sequence,
      percentage: row.percentage.toString(),
      amount: row.amount.toString(),
      dueDate: row.dueDate,
      status: row.status,
    })),
  };
}
