import type { Viewer } from "@/lib/auth/access";
import { activeRole } from "@/lib/auth/period";
import type {
  Actor,
  RoleAssignment,
  RoleName,
  UserStatus,
} from "@/lib/auth/types";
import { prisma } from "@/server/db";

/** Kolom yang dibutuhkan untuk membentuk `Actor`. */
export const ACTOR_SELECT = {
  id: true,
  name: true,
  status: true,
  roleAssignments: {
    select: {
      role: true,
      endedAt: true,
      period: { select: { startDate: true, endDate: true } },
    },
  },
} as const;

interface ActorRow {
  id: string;
  name: string;
  status: string;
  roleAssignments: {
    role: string;
    endedAt: Date | null;
    period: { startDate: Date; endDate: Date };
  }[];
}

/**
 * Masa berlaku jabatan adalah periodenya, dipotong lebih awal bila jabatan
 * itu diakhiri (ganti jabatan atau cabut akses).
 */
export function toRoleAssignments(
  rows: ActorRow["roleAssignments"],
): RoleAssignment[] {
  return rows.map((row) => ({
    role: row.role as RoleName,
    startDate: row.period.startDate,
    endDate:
      row.endedAt && row.endedAt < row.period.endDate
        ? row.endedAt
        : row.period.endDate,
  }));
}

export function toActor(row: ActorRow): Actor {
  return {
    userId: row.id,
    name: row.name,
    status: row.status as UserStatus,
    roleAssignments: toRoleAssignments(row.roleAssignments),
  };
}

export async function loadActor(userId: string): Promise<Actor | null> {
  const row = await prisma.user.findUnique({
    where: { id: userId },
    select: ACTOR_SELECT,
  });
  return row ? toActor(row) : null;
}

export function viewerOf(actor: Actor, now: Date = new Date()): Viewer {
  return { userId: actor.userId, role: activeRole(actor, now) };
}
