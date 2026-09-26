import type { Actor, RoleAssignment, RoleName } from "./types";

/**
 * Masa jabatan berlaku sejak `startDate` inklusif sampai `endDate` eksklusif,
 * sehingga kewenangan berhenti tepat pada tanggal berakhirnya.
 */
export function isWithinPeriod(assignment: RoleAssignment, now: Date): boolean {
  return (
    now.getTime() >= assignment.startDate.getTime() &&
    now.getTime() < assignment.endDate.getTime()
  );
}

export function activeAssignments(
  assignments: readonly RoleAssignment[],
  now: Date,
): RoleAssignment[] {
  return assignments.filter((assignment) => isWithinPeriod(assignment, now));
}

export function hasActiveAssignment(
  assignments: readonly RoleAssignment[],
  now: Date,
): boolean {
  return assignments.some((assignment) => isWithinPeriod(assignment, now));
}

/**
 * Jabatan aktif seseorang. Setiap akun punya satu jabatan aktif (PRD bab
 * 2.1); bila data sempat tumpang tindih, yang dimulai paling akhir yang
 * dipakai karena itulah hasil perubahan jabatan terbaru.
 */
export function activeRole(actor: Actor, now: Date): RoleName | null {
  if (actor.status !== "ACTIVE") return null;

  const current = activeAssignments(actor.roleAssignments, now).sort(
    (a, b) => b.startDate.getTime() - a.startDate.getTime(),
  );

  return current[0]?.role ?? null;
}
