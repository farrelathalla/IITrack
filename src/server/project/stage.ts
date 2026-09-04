import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { checkPermission } from "@/lib/auth/permissions";
import type { Actor, Division } from "@/lib/auth/types";
import { evaluateStageTransition } from "@/lib/project/stage-transition";
import type { StageDefinition } from "@/lib/project/stages";
import { findStage, STAGE_CATALOGUE } from "@/lib/project/stages";
import { recordAudit } from "@/server/audit";
import { prisma } from "@/server/db";

export type ChangeStageResult =
  | { changed: true; fromStage: string | null; toStage: string }
  | { changed: false; reason: string };

export interface ChangeProjectStageInput {
  actor: Actor;
  projectDbId: string;
  toStage: string;
  note?: string | null;
  /** Katalog tahap. Dapat diganti pada pengujian. */
  catalogue?: readonly StageDefinition[];
  /**
   * Divisi tempat actor terdaftar sebagai pelaksana pada project ini.
   *
   * Sementara diisi pemanggil. Sumber sesungguhnya adalah penugasan project
   * yang dibangun pada F04 dan F31; sampai keduanya ada, hanya jabatan yang
   * berwenang secara global seperti COO yang bisa memindahkan tahap.
   */
  assignedDivisions?: Division[];
  now?: Date;
}

/**
 * Memindahkan tahap project dan mencatat riwayatnya.
 *
 * Riwayat ditulis dalam transaksi yang sama dengan perubahan tahapnya, sehingga
 * tidak mungkin ada tahap yang berubah tanpa meninggalkan baris riwayat.
 */
export async function changeProjectStage(
  input: ChangeProjectStageInput,
): Promise<ChangeStageResult> {
  const catalogue = input.catalogue ?? STAGE_CATALOGUE;
  const now = input.now ?? new Date();

  const project = await prisma.project.findUnique({
    where: { id: input.projectDbId },
    select: { id: true, stage: true },
  });

  if (!project) {
    return { changed: false, reason: "Project yang dimaksud tidak ditemukan." };
  }

  const izin = checkPermission({
    actor: input.actor,
    action: "stage.change",
    project: {
      projectId: project.id,
      assignedDivisions: input.assignedDivisions ?? [],
    },
    now,
  });

  if (!izin.allowed) {
    return { changed: false, reason: izin.reason };
  }

  const transisi = evaluateStageTransition({
    catalogue,
    from: project.stage,
    to: input.toStage,
  });

  if (!transisi.allowed) {
    return { changed: false, reason: transisi.reason };
  }

  const fromStage = project.stage;

  await prisma.$transaction([
    prisma.project.update({
      where: { id: project.id },
      data: { stage: input.toStage },
    }),
    prisma.projectStageHistory.create({
      data: {
        projectId: project.id,
        fromStage,
        toStage: input.toStage,
        changedById: input.actor.userId,
        note: input.note ?? null,
      },
    }),
  ]);

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.PROJECT_STAGE_CHANGED,
    objectType: AUDIT_OBJECTS.PROJECT,
    objectId: project.id,
    before: { stage: fromStage },
    after: { stage: input.toStage },
    reason: input.note ?? null,
  });

  return { changed: true, fromStage, toStage: input.toStage };
}

export interface StageHistoryEntry {
  fromStage: string | null;
  fromLabel: string | null;
  toStage: string;
  toLabel: string;
  changedBy: string;
  note: string | null;
  changedAt: Date;
}

/** Riwayat perpindahan tahap sebuah project, terbaru lebih dulu. */
export async function readStageHistory(
  projectDbId: string,
  catalogue: readonly StageDefinition[] = STAGE_CATALOGUE,
): Promise<StageHistoryEntry[]> {
  const rows = await prisma.projectStageHistory.findMany({
    where: { projectId: projectDbId },
    orderBy: { createdAt: "desc" },
    select: {
      fromStage: true,
      toStage: true,
      note: true,
      createdAt: true,
      changedBy: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    fromStage: row.fromStage,
    fromLabel: row.fromStage
      ? (findStage(catalogue, row.fromStage)?.label ?? row.fromStage)
      : null,
    toStage: row.toStage,
    toLabel: findStage(catalogue, row.toStage)?.label ?? row.toStage,
    changedBy: row.changedBy.name,
    note: row.note,
    changedAt: row.createdAt,
  }));
}
