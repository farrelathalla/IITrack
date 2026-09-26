/**
 * Termin pembayaran: validasi skema dan alur status per termin (PRD bab 4.6
 * dan 5). IITrack hanya mencatat status; invoice dan kwitansi dibuat di sistem
 * Finance sendiri.
 */

import type { StageNumber } from "@/lib/project/catalog";
import { isPastDay } from "@/lib/time";

export type TermStep =
  | "NOT_STARTED"
  | "INVOICE_REQUESTED"
  | "PROCESSING"
  | "INVOICE_APPROVED"
  | "SENT_TO_CLIENT"
  | "PROOF_SUBMITTED"
  | "PAYMENT_RECEIVED"
  | "RECEIPT_ISSUED"
  | "DONE";

export interface TermLike {
  sequence: number;
  name: string;
  percentage: number;
  amount: number;
  dueDate: Date | null;
  dueNote: string | null;
  step: TermStep;
  feedback: string | null;
}

// ─── Skema termin ──────────────────────────────────────────────────────────

export interface TermDraft {
  name: string;
  percentage: number;
  amount: number;
  dueDate: Date | null;
  dueNote: string | null;
}

export type SchemeCheck = { valid: true } | { valid: false; errors: string[] };

/**
 * Aturan skema termin: minimal satu termin, total persentase tepat 100%, dan
 * termin pertama adalah DP (PRD bab 4.6 dan 10). Termin pertama selalu
 * diperlakukan sebagai DP oleh sistem, jadi yang dicek di sini adalah namanya
 * tidak menyesatkan.
 */
export function checkTermScheme(drafts: readonly TermDraft[]): SchemeCheck {
  const errors: string[] = [];

  if (drafts.length === 0) {
    return { valid: false, errors: ["Isi minimal satu termin pembayaran."] };
  }

  drafts.forEach((draft, index) => {
    const label = `Termin ${index + 1}`;
    if (draft.name.trim() === "") errors.push(`${label}: nama wajib diisi.`);
    if (!(draft.percentage > 0 && draft.percentage <= 100)) {
      errors.push(
        `${label}: persentase harus lebih dari 0 dan paling besar 100.`,
      );
    }
    if (!(draft.amount >= 0)) {
      errors.push(`${label}: nominal tidak boleh negatif.`);
    }
    if (draft.dueDate === null && (draft.dueNote ?? "").trim() === "") {
      errors.push(
        `${label}: isi due date, atau keterangan seperti "Setelah BAST".`,
      );
    }
  });

  const total = sumPercentage(drafts);
  if (Math.abs(total - 100) > 0.001) {
    errors.push(
      `Total persentase termin harus 100%, sekarang ${formatPercent(total)}.`,
    );
  }

  const first = drafts[0];
  if (first && !/\bDP\b|down\s*payment/i.test(first.name)) {
    errors.push(
      'Termin pertama adalah DP. Beri nama yang memuat "DP", misalnya "Termin 1 — DP".',
    );
  }

  return errors.length === 0 ? { valid: true } : { valid: false, errors };
}

export function sumPercentage(
  drafts: readonly { percentage: number }[],
): number {
  return (
    Math.round(drafts.reduce((sum, d) => sum + d.percentage, 0) * 100) / 100
  );
}

function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value : value.toFixed(2)}%`;
}

// ─── Letak termin pada stage ───────────────────────────────────────────────

/**
 * DP ada di Stage 5, termin final di Stage 7, termin lanjutan di Stage 6
 * (PRD bab 5.2). Bila hanya ada satu termin, termin itu adalah DP.
 */
export function stageOfTerm(sequence: number, totalTerms: number): StageNumber {
  if (sequence === 1) return 5;
  if (sequence === totalTerms) return 7;
  return 6;
}

export function isDownPayment(sequence: number): boolean {
  return sequence === 1;
}

export function isFinalTerm(sequence: number, totalTerms: number): boolean {
  return totalTerms > 1 && sequence === totalTerms;
}

// ─── Transisi status ───────────────────────────────────────────────────────

export type TermAction =
  | "REQUEST_INVOICE"
  | "PROCESS"
  | "REJECT_INVOICE"
  | "APPROVE_INVOICE"
  | "MARK_SENT"
  | "ADD_PROOF"
  | "REJECT_PROOF"
  | "APPROVE_PAYMENT"
  | "ISSUE_RECEIPT"
  | "COMPLETE";

/** Siapa yang boleh menjalankan aksi, dilihat dari perannya di project. */
export type TermActor = "PM" | "FINANCE";

interface TransitionRule {
  from: readonly TermStep[];
  to: TermStep;
  actors: readonly TermActor[];
  label: string;
  /** Penolakan wajib disertai alasan (PRD bab 5.2 dan 10). */
  requiresFeedback?: boolean;
}

export const TERM_TRANSITIONS: Record<TermAction, TransitionRule> = {
  REQUEST_INVOICE: {
    from: ["NOT_STARTED"],
    to: "INVOICE_REQUESTED",
    actors: ["PM"],
    label: "Minta Invoice",
  },
  PROCESS: {
    from: ["INVOICE_REQUESTED"],
    to: "PROCESSING",
    actors: ["FINANCE"],
    label: "Proses",
  },
  REJECT_INVOICE: {
    from: ["INVOICE_REQUESTED", "PROCESSING"],
    to: "NOT_STARTED",
    actors: ["FINANCE"],
    label: "Tolak Permintaan Invoice",
    requiresFeedback: true,
  },
  APPROVE_INVOICE: {
    from: ["PROCESSING"],
    to: "INVOICE_APPROVED",
    actors: ["FINANCE"],
    label: "Setujui Invoice",
  },
  MARK_SENT: {
    from: ["INVOICE_APPROVED"],
    to: "SENT_TO_CLIENT",
    actors: ["FINANCE", "PM"],
    label: "Tandai Dikirim ke Client",
  },
  ADD_PROOF: {
    from: ["SENT_TO_CLIENT"],
    to: "PROOF_SUBMITTED",
    actors: ["PM"],
    label: "Tambah Bukti Transfer",
  },
  REJECT_PROOF: {
    from: ["PROOF_SUBMITTED"],
    to: "SENT_TO_CLIENT",
    actors: ["FINANCE"],
    label: "Tolak Bukti Transfer",
    requiresFeedback: true,
  },
  APPROVE_PAYMENT: {
    from: ["PROOF_SUBMITTED"],
    to: "PAYMENT_RECEIVED",
    actors: ["FINANCE"],
    label: "Setujui Pembayaran",
  },
  ISSUE_RECEIPT: {
    from: ["PAYMENT_RECEIVED"],
    to: "RECEIPT_ISSUED",
    actors: ["FINANCE"],
    label: "Tandai Kwitansi Diterbitkan",
  },
  COMPLETE: {
    from: ["RECEIPT_ISSUED"],
    to: "DONE",
    actors: ["FINANCE"],
    label: "Selesai",
  },
};

export type TransitionCheck =
  | { allowed: true; to: TermStep }
  | { allowed: false; reason: string };

export interface TransitionInput {
  action: TermAction;
  step: TermStep;
  /** Peran pelaku di project ini; kosong berarti tidak punya peran Finance/PM. */
  actorRoles: readonly TermActor[];
  financePocAssigned: boolean;
  /** Apakah stage tempat termin ini berada sudah terbuka. */
  stageUnlocked: boolean;
  feedback?: string | null;
}

/**
 * Memeriksa satu transisi status termin. Pesan penolakan menyebut alasan dan
 * siapa yang harus bertindak (PRD bab 1.1, "Selalu jelaskan kenapa").
 */
export function checkTermTransition(input: TransitionInput): TransitionCheck {
  const rule = TERM_TRANSITIONS[input.action];

  if (!input.actorRoles.some((role) => rule.actors.includes(role))) {
    const who = rule.actors
      .map((a) => (a === "PM" ? "PM project" : "Finance POC atau CFO/VCFO"))
      .join(" atau ");
    return {
      allowed: false,
      reason: `Aksi "${rule.label}" hanya bisa dilakukan ${who}.`,
    };
  }

  if (!input.financePocAssigned) {
    return {
      allowed: false,
      reason: "Finance POC belum ditunjuk. Menunggu CFO/VCFO.",
    };
  }

  if (input.action === "REQUEST_INVOICE" && !input.stageUnlocked) {
    return {
      allowed: false,
      reason:
        "Minta Invoice baru aktif setelah stage yang memuat termin ini terbuka.",
    };
  }

  if (!rule.from.includes(input.step)) {
    return {
      allowed: false,
      reason: `Aksi "${rule.label}" tidak bisa dilakukan saat status termin "${TERM_STEP_LABELS[input.step]}".`,
    };
  }

  if (rule.requiresFeedback && (input.feedback ?? "").trim() === "") {
    return { allowed: false, reason: "Alasan penolakan wajib diisi." };
  }

  return { allowed: true, to: rule.to };
}

/** Aksi yang tersedia untuk pelaku pada status tertentu, untuk tombol UI. */
export function availableTermActions(
  step: TermStep,
  actorRoles: readonly TermActor[],
): TermAction[] {
  return (Object.keys(TERM_TRANSITIONS) as TermAction[]).filter((action) => {
    const rule = TERM_TRANSITIONS[action];
    return (
      rule.from.includes(step) &&
      actorRoles.some((role) => rule.actors.includes(role))
    );
  });
}

// ─── Tampilan status ───────────────────────────────────────────────────────

export const TERM_STEP_LABELS: Record<TermStep, string> = {
  NOT_STARTED: "Belum Dimulai",
  INVOICE_REQUESTED: "Invoice Diminta",
  PROCESSING: "Finance Processing",
  INVOICE_APPROVED: "Disetujui",
  SENT_TO_CLIENT: "Dikirim ke Client",
  PROOF_SUBMITTED: "Menunggu Verifikasi Pembayaran",
  PAYMENT_RECEIVED: "Pembayaran Diterima",
  RECEIPT_ISSUED: "Kwitansi Diterbitkan",
  DONE: "Selesai",
};

/** Tujuh langkah "Alur Pembayaran" seperti di prototipe. */
export const PAYMENT_FLOW_STEPS = [
  "Invoice Diminta",
  "Finance Processing",
  "Disetujui",
  "Dikirim ke Client",
  "Pembayaran Diterima",
  "Kwitansi Diterbitkan",
  "Selesai",
] as const;

/**
 * Posisi termin pada stepper alur pembayaran: indeks langkah yang sedang
 * berjalan, -1 bila belum dimulai, dan 7 bila semua langkah selesai.
 */
export function paymentFlowIndex(step: TermStep): number {
  switch (step) {
    case "NOT_STARTED":
      return -1;
    case "INVOICE_REQUESTED":
      return 0;
    case "PROCESSING":
      return 1;
    case "INVOICE_APPROVED":
      return 2;
    case "SENT_TO_CLIENT":
    case "PROOF_SUBMITTED":
      return 3;
    case "PAYMENT_RECEIVED":
      return 4;
    case "RECEIPT_ISSUED":
      return 5;
    case "DONE":
      return 7;
  }
}

const ORDER: readonly TermStep[] = [
  "NOT_STARTED",
  "INVOICE_REQUESTED",
  "PROCESSING",
  "INVOICE_APPROVED",
  "SENT_TO_CLIENT",
  "PROOF_SUBMITTED",
  "PAYMENT_RECEIVED",
  "RECEIPT_ISSUED",
  "DONE",
];

function atLeast(step: TermStep, target: TermStep): boolean {
  return ORDER.indexOf(step) >= ORDER.indexOf(target);
}

/** Kolom "Status Invoice" (PRD bab 5.3). */
export function invoiceStatusLabel(step: TermStep): string {
  if (step === "NOT_STARTED") return "—";
  if (step === "INVOICE_REQUESTED") return "Diminta";
  if (step === "PROCESSING") return "Diproses";
  if (step === "INVOICE_APPROVED") return "Disetujui";
  return "Dikirim ke Client";
}

/** Kolom "Status Pembayaran" (PRD bab 5.3). */
export function paymentStatusLabel(step: TermStep): string {
  if (step === "NOT_STARTED") return "—";
  if (step === "PROOF_SUBMITTED") return "Menunggu Verifikasi";
  if (atLeast(step, "PAYMENT_RECEIVED")) return "Lunas";
  return "Belum Lunas";
}

/** Kolom "Status Kwitansi" (PRD bab 5.3). */
export function receiptStatusLabel(step: TermStep): string {
  return atLeast(step, "RECEIPT_ISSUED") ? "Diterbitkan" : "—";
}

export type TermStatus = "NOT_DUE" | "IN_PROGRESS" | "OVERDUE" | "PAID";

export const TERM_STATUS_LABELS: Record<TermStatus, string> = {
  NOT_DUE: "Belum Jatuh Tempo",
  IN_PROGRESS: "Dalam Proses",
  OVERDUE: "Overdue",
  PAID: "Lunas",
};

/**
 * Status termin. "Lunas" hanya setelah alurnya Selesai (PRD bab 5.2), dan
 * Overdue bila lewat due date tetapi belum Lunas.
 */
export function termStatus(
  term: Pick<TermLike, "step" | "dueDate">,
  now: Date,
): TermStatus {
  if (term.step === "DONE") return "PAID";
  if (term.dueDate && isPastDay(term.dueDate, now)) {
    return "OVERDUE";
  }
  if (term.step !== "NOT_STARTED") return "IN_PROGRESS";
  return "NOT_DUE";
}

/** Termin sedang menunggu tindakan Finance POC. */
export function isAwaitingFinance(step: TermStep): boolean {
  return (
    step === "INVOICE_REQUESTED" ||
    step === "PROCESSING" ||
    step === "INVOICE_APPROVED" ||
    step === "PROOF_SUBMITTED" ||
    step === "PAYMENT_RECEIVED" ||
    step === "RECEIPT_ISSUED"
  );
}

// ─── Ringkasan keuangan ────────────────────────────────────────────────────

export interface FinancialSummary {
  total: number;
  paid: number;
  remaining: number;
  paidTerms: number;
  totalTerms: number;
}

/** Dihitung dari data termin, bukan diisi manual (PRD bab 5.4). */
export function financialSummary(
  terms: readonly Pick<TermLike, "amount" | "step">[],
): FinancialSummary {
  const total = terms.reduce((sum, t) => sum + t.amount, 0);
  const paidList = terms.filter((t) => t.step === "DONE");
  const paid = paidList.reduce((sum, t) => sum + t.amount, 0);
  return {
    total,
    paid,
    remaining: total - paid,
    paidTerms: paidList.length,
    totalTerms: terms.length,
  };
}
