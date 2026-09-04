import type { RoleAssignment } from "./types";

/**
 * Masa jabatan berlaku sejak `startDate` inklusif sampai `endDate` eksklusif,
 * sehingga kewenangan berhenti tepat pada tanggal berakhirnya. `endDate` kosong
 * berarti belum ditentukan dan jabatannya masih berjalan.
 */
export function isWithinPeriod(assignment: RoleAssignment, now: Date): boolean {
  if (now.getTime() < assignment.startDate.getTime()) return false;
  if (assignment.endDate === null) return true;
  return now.getTime() < assignment.endDate.getTime();
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
