import { AUDIT_OBJECTS } from "@/lib/audit/actions";
import { STAGE_CATALOGUE } from "@/lib/project/stages";
import { prisma } from "@/server/db";

/** Baris daftar project untuk `/projects` (F08). */
export type ProjectListRow = {
  projectId: string;
  name: string;
  clientName: string;
  pmName: string | null;
  stage: string | null;
  updatedAt: Date;
  value: string | null;
  status: string;
};

/**
 * Seluruh project untuk daftar hub. Nilai dikembalikan sebagai string desimal
 * supaya pemanggil UI tidak bergantung pada tipe Decimal Prisma.
 */
export async function listProjectsForHub(): Promise<ProjectListRow[]> {
  const rows = await prisma.project.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      projectId: true,
      name: true,
      clientName: true,
      stage: true,
      updatedAt: true,
      value: true,
      status: true,
      assignedPm: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    projectId: row.projectId,
    name: row.name,
    clientName: row.clientName,
    pmName: row.assignedPm?.name ?? null,
    stage: row.stage,
    updatedAt: row.updatedAt,
    value: row.value?.toString() ?? null,
    status: row.status,
  }));
}

export type ProjectHubData = {
  id: string;
  projectId: string;
  name: string;
  clientName: string;
  period: string;
  status: string;
  value: string | null;
  stage: string | null;
  assignedPmName: string | null;
  registeredByName: string;
  createdAt: Date;
  updatedAt: Date;
  stageHistory: Array<{
    fromStage: string | null;
    toStage: string;
    changedBy: string;
    note: string | null;
    changedAt: Date;
  }>;
  auditTrail: Array<{
    action: string;
    actorName: string | null;
    reason: string | null;
    createdAt: Date;
  }>;
  /** Tahap yang dikenal katalog (untuk strip tracker). */
  knownStages: Array<{ key: string; order: number; label: string }>;
};

/** Membaca satu project lewat nomor resmi `IIT-….`. */
export async function getProjectHubByProjectId(
  projectId: string,
): Promise<ProjectHubData | null> {
  const project = await prisma.project.findUnique({
    where: { projectId },
    select: {
      id: true,
      projectId: true,
      name: true,
      clientName: true,
      period: true,
      status: true,
      value: true,
      stage: true,
      createdAt: true,
      updatedAt: true,
      assignedPm: { select: { name: true } },
      registeredBy: { select: { name: true } },
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
    },
  });

  if (!project) return null;

  const auditTrail = await prisma.auditLog.findMany({
    where: {
      objectType: AUDIT_OBJECTS.PROJECT,
      objectId: project.id,
    },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      action: true,
      reason: true,
      createdAt: true,
      actor: { select: { name: true } },
    },
  });

  return {
    id: project.id,
    projectId: project.projectId,
    name: project.name,
    clientName: project.clientName,
    period: project.period,
    status: project.status,
    value: project.value?.toString() ?? null,
    stage: project.stage,
    assignedPmName: project.assignedPm?.name ?? null,
    registeredByName: project.registeredBy.name,
    createdAt: project.createdAt,
    updatedAt: project.updatedAt,
    stageHistory: project.stageHistory.map((row) => ({
      fromStage: row.fromStage,
      toStage: row.toStage,
      changedBy: row.changedBy.name,
      note: row.note,
      changedAt: row.createdAt,
    })),
    auditTrail: auditTrail.map((row) => ({
      action: row.action,
      actorName: row.actor?.name ?? null,
      reason: row.reason,
      createdAt: row.createdAt,
    })),
    knownStages: STAGE_CATALOGUE.map((stage) => ({
      key: stage.key,
      order: stage.order,
      label: stage.label,
    })),
  };
}
