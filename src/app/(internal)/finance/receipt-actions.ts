"use server";

import {
  parseTransferProofForm,
  parseValidateReceiptForm,
} from "@/lib/finance/receipt-form";
import { getAuthenticatedSession } from "@/server/auth/session";
import { recordTransferProof, validateReceipt } from "@/server/finance/receipt";

export interface RecordTransferProofFormState {
  error: string | null;
  fields?: Record<string, string>;
  warning?: string | null;
  success?: string | null;
  savedAt?: number;
}

export async function recordTransferProofAction(
  _previous: RecordTransferProofFormState,
  formData: FormData,
): Promise<RecordTransferProofFormState> {
  const session = await getAuthenticatedSession();
  if (!session) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const parsed = parseTransferProofForm({
    invoiceId: String(formData.get("invoiceId") ?? ""),
    amount: String(formData.get("amount") ?? ""),
    paidAt: String(formData.get("paidAt") ?? ""),
    proofUrl: String(formData.get("proofUrl") ?? ""),
    proofNote: String(formData.get("proofNote") ?? ""),
  });
  if (!parsed.ok) {
    return { error: parsed.reason, fields: parsed.fields };
  }

  const result = await recordTransferProof({
    actor: session.actor,
    invoiceId: parsed.data.invoiceId,
    amount: parsed.data.amount,
    paidAt: parsed.data.paidAt,
    proofUrl: parsed.data.proofUrl,
    proofNote: parsed.data.proofNote,
  });

  if (!result.ok) return { error: result.reason };

  return {
    error: null,
    warning: result.warning,
    success: result.warning
      ? `Kuitansi ${result.number} tercatat, dengan peringatan selisih.`
      : `Kuitansi ${result.number} tercatat.`,
    savedAt: Date.now(),
  };
}

export interface ValidateReceiptFormState {
  error: string | null;
  fields?: Record<string, string>;
  success?: string | null;
  savedAt?: number;
}

export async function validateReceiptAction(
  _previous: ValidateReceiptFormState,
  formData: FormData,
): Promise<ValidateReceiptFormState> {
  const session = await getAuthenticatedSession();
  if (!session) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const parsed = parseValidateReceiptForm({
    receiptId: String(formData.get("receiptId") ?? ""),
    resolution: String(formData.get("resolution") ?? ""),
  });
  if (!parsed.ok) {
    return { error: parsed.reason, fields: parsed.fields };
  }

  const result = await validateReceipt({
    actor: session.actor,
    receiptId: parsed.data.receiptId,
    resolution: parsed.data.resolution,
  });

  if (!result.ok) return { error: result.reason };

  return {
    error: null,
    success: `Kuitansi dinyatakan valid. Termin ${result.terminSequence} berstatus lunas.`,
    savedAt: Date.now(),
  };
}
