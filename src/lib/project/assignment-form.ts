/**
 * Baca isian form penugasan pelaksana sebelum dikirim ke `assignMember`.
 */

import type { Division } from "@/lib/auth/types";

const DIVISIONS = new Set<Division>(["OPERATIONAL", "FINANCE", "TECHDEV"]);

export type AssignmentFormFields = {
  projectDbId: string;
  division: string;
  userId: string;
};

export type ParsedAssignmentForm = {
  projectDbId: string;
  division: Division;
  userId: string;
};

export type AssignmentFormParseResult =
  | { ok: true; data: ParsedAssignmentForm }
  | { ok: false; reason: string; fields: Record<string, string> };

export function parseAssignmentForm(
  input: AssignmentFormFields,
): AssignmentFormParseResult {
  const fields: Record<string, string> = {};
  const projectDbId = input.projectDbId.trim();
  const divisionRaw = input.division.trim();
  const userId = input.userId.trim();

  if (!projectDbId) {
    return {
      ok: false,
      reason: "Project yang dimaksud tidak ditemukan.",
      fields,
    };
  }

  if (!DIVISIONS.has(divisionRaw as Division)) {
    fields.division = "Pilih divisi terlebih dahulu.";
  }

  if (!userId) {
    fields.userId = "Pilih pengurus yang akan ditugaskan.";
  }

  if (Object.keys(fields).length > 0) {
    return {
      ok: false,
      reason: "Lengkapi isian penugasan terlebih dahulu.",
      fields,
    };
  }

  return {
    ok: true,
    data: {
      projectDbId,
      division: divisionRaw as Division,
      userId,
    },
  };
}
