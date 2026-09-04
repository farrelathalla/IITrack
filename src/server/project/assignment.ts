import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { activeAssignments } from "@/lib/auth/period";
import { checkPermission } from "@/lib/auth/permissions";
import type { Actor, Division, RoleName } from "@/lib/auth/types";
import type {
  SlaEvaluation,
  WorkingHoursConfig,
} from "@/lib/sla/working-hours";
import {
  DEFAULT_WORKING_HOURS,
  evaluateSla,
  SLA_PM_ASSIGNMENT_MINUTES,
} from "@/lib/sla/working-hours";
import { recordAudit } from "@/server/audit";
import { prisma } from "@/server/db";

export type AssignPmResult =
  | { assigned: true; sla: SlaEvaluation | null }
  | { assigned: false; reason: string };

export interface AssignProjectManagerInput {
  actor: Actor;
  projectDbId: string;
  pmUserId: string;
  /** Waktu client mengonfirmasi. Bila kosong, dipakai yang sudah tersimpan. */
  clientConfirmedAt?: Date | null;
  workingHours?: WorkingHoursConfig;
  now?: Date;
}

/**
 * Menugaskan PM pada sebuah project dan mengukur lamanya terhadap SLA.
 *
 * Penugasan inilah yang memberi hak edit Operational kepada PM yang ditunjuk,
 * tanpa pengaturan izin manual (F04-AC2).
 */
export async function assignProjectManager(
  input: AssignProjectManagerInput,
): Promise<AssignPmResult> {
  const now = input.now ?? new Date();

  const izin = checkPermission({
    actor: input.actor,
    action: "project.assign_pm",
    now,
  });

  if (!izin.allowed) {
    return { assigned: false, reason: izin.reason };
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectDbId },
    select: { id: true, assignedPmId: true, clientConfirmedAt: true },
  });

  if (!project) {
    return {
      assigned: false,
      reason: "Project yang dimaksud tidak ditemukan.",
    };
  }

  const calon = await prisma.user.findUnique({
    where: { id: input.pmUserId },
    select: {
      id: true,
      name: true,
      status: true,
      roleAssignments: {
        select: {
          role: true,
          division: true,
          startDate: true,
          endDate: true,
          isSystemAdmin: true,
        },
      },
    },
  });

  if (calon?.status !== "ACTIVE") {
    return {
      assigned: false,
      reason:
        "Pengurus yang dipilih tidak aktif, jadi belum bisa ditugaskan sebagai PM.",
    };
  }

  // Menugaskan orang yang jabatannya bukan PM akan memberinya hak edit yang
  // tidak seharusnya, jadi diperiksa di sini alih-alih dipercayakan ke antarmuka.
  const isActivePm = activeAssignments(
    calon.roleAssignments.map((a) => ({
      role: a.role as RoleName,
      division: a.division as Division,
      startDate: a.startDate,
      endDate: a.endDate,
      isSystemAdmin: a.isSystemAdmin,
    })),
    now,
  ).some((assignment) => assignment.role === "PROJECT_MANAGER");

  if (!isActivePm) {
    return {
      assigned: false,
      reason: `${calon.name} tidak sedang menjabat sebagai Project Manager, jadi belum bisa ditugaskan.`,
    };
  }

  const clientConfirmedAt =
    input.clientConfirmedAt ?? project.clientConfirmedAt;

  await prisma.project.update({
    where: { id: project.id },
    data: {
      assignedPmId: calon.id,
      pmAssignedAt: now,
      clientConfirmedAt,
    },
  });

  const sla = clientConfirmedAt
    ? evaluateSla(
        clientConfirmedAt,
        now,
        SLA_PM_ASSIGNMENT_MINUTES,
        input.workingHours ?? DEFAULT_WORKING_HOURS,
      )
    : null;

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.PROJECT_PM_ASSIGNED,
    objectType: AUDIT_OBJECTS.PROJECT,
    objectId: project.id,
    before: { assignedPmId: project.assignedPmId },
    after: {
      assignedPmId: calon.id,
      slaMenitKerja: sla?.workingMinutes ?? null,
      slaTerpenuhi: sla?.withinThreshold ?? null,
    },
  });

  return { assigned: true, sla };
}
