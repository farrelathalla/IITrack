/**
 * Baca isian form permintaan programmer sebelum dikirim ke `requestStaffing`.
 *
 * Pesan galat meniru skema Zod di server supaya UI dan API tidak beda lidah.
 */

import { parseDateInput } from "@/lib/member/ui";

export type StaffingFormFields = {
  roleNeeded: string;
  headcount: string;
  neededBy: string;
  technicalNeeds: string;
  deliverable: string;
};

export type ParsedStaffingRequest = {
  roleNeeded: string;
  headcount: number;
  neededBy: Date;
  technicalNeeds: string;
  deliverable: string;
};

export function parseHeadcount(
  raw: string,
): { ok: true; value: number } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed === "") {
    return { ok: false, message: "Jumlah orang minimal satu." };
  }

  const value = Number(trimmed);
  if (!Number.isInteger(value)) {
    return { ok: false, message: "Jumlah orang harus bilangan bulat." };
  }
  if (value < 1) {
    return { ok: false, message: "Jumlah orang minimal satu." };
  }
  return { ok: true, value };
}

export function parseStaffingRequestForm(
  input: StaffingFormFields,
):
  | { ok: true; data: ParsedStaffingRequest }
  | { ok: false; reason: string; fields: Record<string, string> } {
  const fields: Record<string, string> = {};

  const roleNeeded = input.roleNeeded.trim();
  if (roleNeeded.length === 0) {
    fields.roleNeeded = "Jabatan yang dibutuhkan wajib diisi.";
  }

  const headcount = parseHeadcount(input.headcount);
  if (!headcount.ok) fields.headcount = headcount.message;

  const neededBy = parseDateInput(input.neededBy);
  if (!neededBy) {
    fields.neededBy = "Tanggal dibutuhkan wajib diisi.";
  }

  const technicalNeeds = input.technicalNeeds.trim();
  if (technicalNeeds.length === 0) {
    fields.technicalNeeds = "Kebutuhan teknis wajib diisi.";
  }

  const deliverable = input.deliverable.trim();
  if (deliverable.length === 0) {
    fields.deliverable = "Deliverable wajib diisi.";
  }

  if (Object.keys(fields).length > 0 || !neededBy || !headcount.ok) {
    return {
      ok: false,
      reason:
        "Permintaan belum bisa diajukan karena ada isian yang belum lengkap.",
      fields,
    };
  }

  return {
    ok: true,
    data: {
      roleNeeded,
      headcount: headcount.value,
      neededBy,
      technicalNeeds,
      deliverable,
    },
  };
}
