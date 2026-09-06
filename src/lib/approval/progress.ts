import type { ApprovalStepSpec } from "./chain";

/**
 * Perpindahan antar langkah persetujuan (F17).
 *
 * Dipisahkan dari basis data supaya aturan "kapan pengajuan selesai, kapan
 * diteruskan, dan kapan berhenti" bisa diuji tanpa menyiapkan satu pun baris.
 */

export type StepDecision = "APPROVED" | "REJECTED";

export type SubmissionOutcome =
  | { outcome: "advanced"; nextStepOrder: number }
  | { outcome: "approved" }
  | { outcome: "rejected" };

export type DecideStepResult =
  | { valid: true; result: SubmissionOutcome }
  | { valid: false; reason: string };

export interface DecideStepInput {
  chain: readonly ApprovalStepSpec[];
  currentOrder: number;
  decision: StepDecision;
  /** Wajib diisi pada penolakan. */
  reason?: string | null;
}

export function decideStep(input: DecideStepInput): DecideStepResult {
  const { chain, currentOrder, decision } = input;

  const current = chain.find((step) => step.order === currentOrder);

  if (!current) {
    return {
      valid: false,
      reason:
        "Langkah persetujuan yang dimaksud tidak ada pada rantai pengajuan ini, jadi keputusannya tidak bisa dicatat.",
    };
  }

  if (decision === "REJECTED") {
    if (!input.reason || input.reason.trim().length === 0) {
      return {
        valid: false,
        reason:
          "Penolakan wajib menyertakan alasannya, supaya pengaju tahu apa yang harus diperbaiki.",
      };
    }

    return { valid: true, result: { outcome: "rejected" } };
  }

  const next = chain
    .filter((step) => step.order > currentOrder)
    .sort((a, b) => a.order - b.order)[0];

  if (!next) {
    return { valid: true, result: { outcome: "approved" } };
  }

  return {
    valid: true,
    result: { outcome: "advanced", nextStepOrder: next.order },
  };
}
