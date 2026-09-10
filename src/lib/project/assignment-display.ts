/**
 * Kontrak tampilan F31-T02 (pemilih pelaksana di panel Tim hub).
 *
 * Modul ini murni: tanpa React/Prisma. Penugasan hanya untuk C-Level pada
 * divisi yang dipimpinnya; lintas domain ditolak di server (F31-AC1).
 */

import { activeAssignments } from "@/lib/auth/period";
import { can } from "@/lib/auth/permissions";
import type { Actor, Division } from "@/lib/auth/types";
import {
  canAssignToDivision,
  divisionGovernedBy,
} from "@/lib/project/assignment-rules";

export const ASSIGNMENT_FORM_PLACEMENT = {
  surface: "hub",
  section: "team",
} as const;

export type AssignmentFormFieldKey = "division" | "userId";

export interface AssignmentFormField {
  key: AssignmentFormFieldKey;
  label: string;
  required: true;
  control: "select";
}

/** Isian pemilih: divisi domain + pengurus aktif di divisi itu. */
export const ASSIGNMENT_FORM_FIELDS: readonly AssignmentFormField[] = [
  {
    key: "division",
    label: "Divisi",
    required: true,
    control: "select",
  },
  {
    key: "userId",
    label: "Pengurus",
    required: true,
    control: "select",
  },
];

export function divisionLabel(division: Division): string {
  switch (division) {
    case "OPERATIONAL":
      return "Operational";
    case "FINANCE":
      return "Finance";
    case "TECHDEV":
      return "TechDev";
  }
}

/** Divisi yang boleh dipilih si aktor pada form penugasan. */
export function assignableDivisionsFor(
  actor: Actor,
  now: Date = new Date(),
): Division[] {
  const seen = new Set<Division>();
  for (const row of activeAssignments(actor.roleAssignments, now)) {
    const division = divisionGovernedBy(row.role);
    if (division) seen.add(division);
  }
  return [...seen];
}

/**
 * Tombol/form penugasan: pemegang `project.assign_member` (C-Level / wakil).
 * Bukan PM pelaksana — PM mengajukan staffing, bukan menunjuk antar-divisi.
 */
export function canSeeAssignMemberForm(
  actor: Actor,
  now: Date = new Date(),
): boolean {
  return can({
    actor,
    action: "project.assign_member",
    project: { projectId: "*", assignedDivisions: [] },
    now,
  });
}

/** Tombol akhiri hanya untuk divisi yang dipimpin si aktor. */
export function canSeeEndAssignment(
  actor: Actor,
  division: Division,
  now: Date = new Date(),
): boolean {
  return (
    canSeeAssignMemberForm(actor, now) &&
    canAssignToDivision(actor, division, now)
  );
}
