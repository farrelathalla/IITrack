/**
 * Kontrak tampilan F16-T03 (formulir pengajuan invoice).
 *
 * Modul ini murni: tanpa React/Prisma. Form mengisi panel Termin hub, bukan
 * item nav baru. Priority Zero (F19 Should Have) sengaja tidak ada di sini.
 */

import { can } from "@/lib/auth/permissions";
import type { Actor, ProjectContext } from "@/lib/auth/types";
import type { ExistingInvoice } from "@/lib/finance/invoice";
import { reasonTerminCannotBeInvoiced } from "@/lib/finance/invoice";

export const INVOICE_FORM_PLACEMENT = {
  surface: "hub",
  section: "termin",
} as const;

export type InvoiceTerminOption = {
  id: string;
  sequence: number;
  percentage: string;
  amount: string;
  dueDateIso: string;
  status: "UNPAID" | "PAID";
  blockedReason: string | null;
};

/** Kolom yang diisi sistem dari project dan termin, bukan diketik pengaju. */
export const INVOICE_AUTO_FIELDS = [
  "number",
  "projectId",
  "clientName",
  "amount",
  "dueDate",
] as const;

export type InvoiceAutoFieldKey = (typeof INVOICE_AUTO_FIELDS)[number];

export type InvoiceManualFieldKey = "description" | "notes";

export interface InvoiceManualField {
  key: InvoiceManualFieldKey;
  label: string;
  required: false;
  control: "textarea";
}

export const INVOICE_MANUAL_FIELDS: readonly InvoiceManualField[] = [
  {
    key: "description",
    label: "Keterangan",
    required: false,
    control: "textarea",
  },
  {
    key: "notes",
    label: "Catatan",
    required: false,
    control: "textarea",
  },
];

/** Yang sengaja tidak ada di form, supaya tidak dikarang belakangan. */
export const INVOICE_FORM_EXCLUSIONS = [
  "priorityZero",
  "amount",
  "clientName",
  "projectId",
  "number",
] as const;

export type ParsedInvoiceRequest = {
  terminId: string;
  description: string | null;
  notes: string | null;
};

export type InvoiceRequestFormParseResult =
  | { ok: true; data: ParsedInvoiceRequest }
  | { ok: false; reason: string; fields: Record<string, string> };

export function parseInvoiceRequestForm(input: {
  terminId: string;
  description?: string;
  notes?: string;
}): InvoiceRequestFormParseResult {
  const fields: Record<string, string> = {};
  const terminId = input.terminId.trim();
  if (terminId.length === 0) {
    fields.terminId = "Pilih termin yang akan ditagihkan.";
  }

  if (Object.keys(fields).length > 0) {
    return {
      ok: false,
      reason: "Pengajuan belum bisa dikirim karena terminnya belum dipilih.",
      fields,
    };
  }

  const description = input.description?.trim() ?? "";
  const notes = input.notes?.trim() ?? "";

  return {
    ok: true,
    data: {
      terminId,
      description: description.length > 0 ? description : null,
      notes: notes.length > 0 ? notes : null,
    },
  };
}

export function invoiceBlockedReason(
  existing: readonly ExistingInvoice[],
  sequence: number,
  status: string,
): string | null {
  if (status === "PAID") {
    return `Termin ${sequence} sudah lunas, jadi tidak perlu ditagihkan lagi.`;
  }
  return reasonTerminCannotBeInvoiced(existing, sequence);
}

/** Tombol ajukan: PM yang ditugaskan, bukan siapa pun yang finance.view. */
export function canSeeInvoiceRequestForm(
  actor: Actor,
  project: ProjectContext,
  now: Date = new Date(),
): boolean {
  return can({ actor, action: "finance.submit", project, now });
}
