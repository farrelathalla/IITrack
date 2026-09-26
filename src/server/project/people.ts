import {
  ASSIGNABLE_ROLES,
  PROJECT_ROLE_LABELS,
  ROLE_LABELS,
} from "@/lib/auth/roles";
import type { ProjectRole, RoleName } from "@/lib/auth/types";
import type { Tx } from "@/server/activity";
import { prisma } from "@/server/db";
import { ActionError } from "./mutate";

function activeRoleWhere(roles: readonly RoleName[], now: Date) {
  return {
    role: { in: [...roles] },
    OR: [{ endedAt: null }, { endedAt: { gt: now } }],
    period: { startDate: { lte: now }, endDate: { gt: now } },
  };
}

export interface Candidate {
  id: string;
  name: string;
  email: string;
  role: RoleName;
  activeProjects: number;
}

/**
 * Calon penugasan: hanya anggota aktif dari divisi terkait, beserta jumlah
 * project aktif masing-masing (PRD bab 8.4).
 */
export async function candidatesFor(
  projectRole: ProjectRole,
  now: Date = new Date(),
): Promise<Candidate[]> {
  const roles = ASSIGNABLE_ROLES[projectRole];
  const users = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      roleAssignments: { some: activeRoleWhere(roles, now) },
    },
    select: {
      id: true,
      name: true,
      email: true,
      roleAssignments: {
        where: activeRoleWhere(roles, now),
        select: { role: true },
        take: 1,
      },
      assignments: {
        where: { endedAt: null, project: { closedAt: null } },
        select: { projectId: true },
      },
    },
    orderBy: { name: "asc" },
  });

  return users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.roleAssignments[0]?.role as RoleName,
    activeProjects: new Set(user.assignments.map((a) => a.projectId)).size,
  }));
}

/**
 * Penugasan hanya bisa diberikan kepada akun aktif dari divisi yang sesuai
 * (PRD bab 2.2). Diperiksa di server, bukan hanya lewat daftar pilihan.
 */
export async function assertEligible(
  tx: Tx,
  userId: string,
  projectRole: ProjectRole,
  now: Date,
): Promise<{ id: string; name: string }> {
  const roles = ASSIGNABLE_ROLES[projectRole];
  const user = await tx.user.findFirst({
    where: {
      id: userId,
      status: "ACTIVE",
      roleAssignments: { some: activeRoleWhere(roles, now) },
    },
    select: { id: true, name: true },
  });
  if (!user) {
    throw new ActionError(
      `Orang ini tidak bisa ditugaskan sebagai ${PROJECT_ROLE_LABELS[projectRole]}. Pilih akun aktif dengan jabatan ${roles.map((r) => ROLE_LABELS[r]).join(" atau ")}.`,
    );
  }
  return user;
}
