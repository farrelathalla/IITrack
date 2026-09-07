/**
 * Kontrak tampilan F20-T03 (formulir kuitansi + tautan bukti transfer).
 *
 * Modul ini murni. Bukti transfer adalah alamat https, bukan berkas yang
 * disimpan di IITrack — Adnan API menerima `proofUrl`. Priority Zero tidak ada.
 */

import { can } from "@/lib/auth/permissions";
import type { Actor, ProjectContext } from "@/lib/auth/types";
import { parseDateInput } from "@/lib/member/ui";
import { normalizeReferenceUrl } from "@/lib/project/external-reference";
import { parseScaledDecimal } from "@/lib/termin/scheme";

export const RECEIPT_FORM_PLACEMENT = {
  surfaces: ["hub", "detail"] as const,
  hubSection: "termin",
} as const;

export const RECEIPT_AUTO_FIELDS = [
  "number",
  "projectId",
  "invoiceNumber",
] as const;

export const RECEIPT_MANUAL_FIELDS = [
  { key: "amount", label: "Nominal diterima", required: true, control: "text" },
  { key: "paidAt", label: "Tanggal transfer", required: true, control: "date" },
  {
    key: "proofUrl",
    label: "Tautan bukti transfer",
    required: true,
    control: "url",
  },
  {
    key: "proofNote",
    label: "Catatan bukti",
    required: false,
    control: "textarea",
  },
] as const;

export const RECEIPT_FORM_EXCLUSIONS = [
  "fileUpload",
  "binaryStore",
  "priorityZero",
] as const;

export type ParsedTransferProof = {
  invoiceId: string;
  amount: string;
  paidAt: Date;
  proofUrl: string;
  proofNote: string | null;
};

export type TransferProofParseResult =
  | { ok: true; data: ParsedTransferProof }
  | { ok: false; reason: string; fields: Record<string, string> };

export type ParsedReceiptValidation = {
  receiptId: string;
  resolution: string | null;
};

export type ReceiptValidationParseResult =
  | { ok: true; data: ParsedReceiptValidation }
  | { ok: false; reason: string; fields: Record<string, string> };

export function canSeeReceiptForm(
  actor: Actor,
  project: ProjectContext,
  now: Date = new Date(),
): boolean {
  return can({ actor, action: "finance.submit", project, now });
}

export function canSeeValidateReceipt(
  actor: Actor,
  project: ProjectContext,
  now: Date = new Date(),
): boolean {
  return can({ actor, action: "finance.edit", project, now });
}

export function parseTransferProofForm(input: {
  invoiceId: string;
  amount: string;
  paidAt: string;
  proofUrl: string;
  proofNote?: string;
}): TransferProofParseResult {
  const fields: Record<string, string> = {};
  const invoiceId = input.invoiceId.trim();
  if (invoiceId.length === 0) {
    fields.invoiceId = "Invoice rujukan tidak ditemukan.";
  }

  const amountRaw = input.amount.trim();
  const sen = parseScaledDecimal(amountRaw, 2);
  if (sen === null || sen <= BigInt(0)) {
    fields.amount =
      "Nilai kuitansi harus lebih besar dari nol, paling banyak dua angka di belakang koma.";
  }

  const paidAt = parseDateInput(input.paidAt);
  if (!paidAt) {
    fields.paidAt = "Tanggal transfer wajib diisi.";
  }

  const proofUrl = normalizeReferenceUrl(input.proofUrl);
  if (!proofUrl) {
    fields.proofUrl =
      "Tautan bukti transfer harus berupa alamat https yang lengkap, misalnya tautan Google Drive.";
  }

  if (Object.keys(fields).length > 0 || !paidAt || !proofUrl || sen === null) {
    return {
      ok: false,
      reason:
        "Kuitansi belum bisa dicatat karena ada isian yang belum lengkap.",
      fields,
    };
  }

  const proofNote = input.proofNote?.trim() ?? "";
  return {
    ok: true,
    data: {
      invoiceId,
      amount: amountRaw,
      paidAt,
      proofUrl,
      proofNote: proofNote.length > 0 ? proofNote : null,
    },
  };
}

export function parseValidateReceiptForm(input: {
  receiptId: string;
  resolution?: string;
}): ReceiptValidationParseResult {
  const receiptId = input.receiptId.trim();
  if (receiptId.length === 0) {
    return {
      ok: false,
      reason: "Kuitansi yang dimaksud tidak ditemukan.",
      fields: { receiptId: "Kuitansi yang dimaksud tidak ditemukan." },
    };
  }

  const resolution = input.resolution?.trim() ?? "";
  return {
    ok: true,
    data: {
      receiptId,
      resolution: resolution.length > 0 ? resolution : null,
    },
  };
}
