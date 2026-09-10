/**
 * Kontrak tampilan F17-T04 (tombol setuju/tolak pada rincian pengajuan).
 *
 * Modul ini murni: tanpa React/Prisma. Tombolnya hanya di halaman rincian
 * yang dikunci F15-T03, bukan di baris antrean. Penolakan wajib alasan.
 */

import {
  type ApprovalStepSpec,
  buildApprovalChain,
  isEligibleApprover,
} from "@/lib/approval/chain";
import type { Actor } from "@/lib/auth/types";
import { FINANCE_SUBMISSION_DECISION_PLACEMENT } from "@/lib/finance/display";
import type { FinanceQueueItem } from "@/lib/finance/queue";

export const SUBMISSION_DECISION_PLACEMENT =
  FINANCE_SUBMISSION_DECISION_PLACEMENT;

export type SubmissionDecision = "APPROVED" | "REJECTED";

export const SUBMISSION_DECISION_BUTTONS = [
  { decision: "APPROVED" as const, label: "Setujui", variant: "primary" },
  { decision: "REJECTED" as const, label: "Tolak", variant: "danger" },
] as const;

export type ParsedSubmissionDecision = {
  submissionId: string;
  decision: SubmissionDecision;
  reason: string | null;
};

export type SubmissionDecisionParseResult =
  | { ok: true; data: ParsedSubmissionDecision }
  | { ok: false; reason: string; fields: Record<string, string> };

/**
 * Langkah invoice yang sedang menunggu keputusan, atau kosong.
 *
 * Dicocokkan memakai nomor langkah, bukan namanya. Nama langkah disalin ke
 * baris basis data saat pengajuan dibuat, sedangkan rantai di kode bisa
 * berubah namanya; pemetaan langkah kedua ke "POC dokumentasi" bahkan masih
 * menunggu DEP-02. Kalau dicocokkan dari nama, penggantian kata satu kali saja
 * membuat tombol setuju dan tolak hilang dari seluruh pengajuan yang terlanjur
 * menunggu, tanpa penyetujunya tahu sebabnya.
 */
export function currentInvoiceApprovalStep(
  item: Pick<FinanceQueueItem, "state" | "currentStepOrder">,
): ApprovalStepSpec | null {
  if (item.state !== "MENUNGGU_PERSETUJUAN" || item.currentStepOrder === null) {
    return null;
  }
  return (
    buildApprovalChain("INVOICE").find(
      (step) => step.order === item.currentStepOrder,
    ) ?? null
  );
}

/**
 * Tombol keputusan: hanya pemegang langkah yang sedang berjalan.
 *
 * Menyembunyikan tombol tidak menggantikan `decideSubmission` di server
 * (F17-AC4). Pengajuan yang menunggu pembayaran atau verifikasi kuitansi
 * tidak punya langkah persetujuan.
 */
export function canSeeSubmissionDecision(
  actor: Actor,
  item: Pick<FinanceQueueItem, "state" | "currentStepOrder">,
  now: Date = new Date(),
): boolean {
  const langkah = currentInvoiceApprovalStep(item);
  return langkah !== null && isEligibleApprover(actor, langkah, now);
}

export function parseSubmissionDecisionForm(input: {
  submissionId: string;
  decision: string;
  reason?: string;
}): SubmissionDecisionParseResult {
  const fields: Record<string, string> = {};
  const submissionId = input.submissionId.trim();
  if (submissionId.length === 0) {
    fields.submissionId = "Pengajuan yang dimaksud tidak ditemukan.";
  }

  const decision = input.decision.trim();
  if (decision !== "APPROVED" && decision !== "REJECTED") {
    fields.decision = "Pilih Setujui atau Tolak.";
  }

  if (Object.keys(fields).length > 0) {
    return {
      ok: false,
      reason: "Keputusan belum bisa dicatat karena isiannya belum lengkap.",
      fields,
    };
  }

  const reason = input.reason?.trim() ?? "";
  if (decision === "REJECTED" && reason.length === 0) {
    const pesan =
      "Penolakan wajib menyertakan alasannya, supaya pengaju tahu apa yang harus diperbaiki.";
    return {
      ok: false,
      reason: pesan,
      fields: { reason: pesan },
    };
  }

  return {
    ok: true,
    data: {
      submissionId,
      decision: decision as SubmissionDecision,
      reason: reason.length > 0 ? reason : null,
    },
  };
}
