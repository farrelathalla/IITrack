/**
 * Closure Checklist, syarat Finance Disbursement, dan Status Final
 * (PRD bab 4.12 dan 5.5).
 */

import { daysUntil } from "@/lib/time";
import { documentOf, type ProjectSnapshot, warrantyStatus } from "./snapshot";
import { isFeedbackComplete } from "./stages";

export interface ChecklistItem {
  key: string;
  label: string;
  done: boolean;
}

function allTermsPaid(project: ProjectSnapshot): boolean {
  return (
    project.terms.length > 0 && project.terms.every((t) => t.step === "DONE")
  );
}

function linked(
  project: ProjectSnapshot,
  kind: "PROJECT_DOCUMENTATION" | "SOURCE_CODE_DOCUMENTATION",
): boolean {
  return Boolean(documentOf(project, kind)?.url);
}

/** Item tercentang otomatis dari data, sesuai prototipe. */
export function closureChecklist(
  project: ProjectSnapshot,
  now: Date,
): ChecklistItem[] {
  return [
    {
      key: "terms",
      label: "Semua Termin Pembayaran Lunas",
      done: allTermsPaid(project),
    },
    {
      key: "warranty",
      label: "Garansi Selesai",
      done: warrantyStatus(project.handover, now) === "DONE",
    },
    {
      key: "clientFeedback",
      label: "Client Feedback",
      done: isFeedbackComplete(documentOf(project, "CLIENT_FEEDBACK")),
    },
    {
      key: "programmerFeedback",
      label: "Programmer Feedback",
      done: isFeedbackComplete(documentOf(project, "PROGRAMMER_FEEDBACK")),
    },
    {
      key: "projectDoc",
      label: "Project Documentation",
      done: linked(project, "PROJECT_DOCUMENTATION"),
    },
    {
      key: "sourceCodeDoc",
      label: "Source Code Documentation",
      done: linked(project, "SOURCE_CODE_DOCUMENTATION"),
    },
    {
      key: "disbursement",
      label: "Finance Disbursement",
      done: project.disbursement?.status === "DISBURSED",
    },
  ];
}

export function isReadyToClose(project: ProjectSnapshot, now: Date): boolean {
  return closureChecklist(project, now).every((item) => item.done);
}

export type DisbursementReadiness =
  | { ready: true }
  | { ready: false; missing: string[] };

/**
 * Ajukan Finance Disbursement aktif setelah semua termin Lunas, garansi
 * Selesai, dan kedua feedback lengkap (PRD bab 5.5).
 */
export function disbursementReadiness(
  project: ProjectSnapshot,
  now: Date,
): DisbursementReadiness {
  const missing = closureChecklist(project, now)
    .filter((item) =>
      ["terms", "warranty", "clientFeedback", "programmerFeedback"].includes(
        item.key,
      ),
    )
    .filter((item) => !item.done)
    .map((item) => item.label);
  return missing.length === 0 ? { ready: true } : { ready: false, missing };
}

export type DisbursementDisplay =
  | "NOT_AVAILABLE"
  | "SUBMITTED"
  | "VERIFIED"
  | "APPROVED"
  | "DISBURSED"
  | "REJECTED";

export const DISBURSEMENT_LABELS: Record<DisbursementDisplay, string> = {
  NOT_AVAILABLE: "Belum Tersedia",
  SUBMITTED: "Diajukan",
  VERIFIED: "Diverifikasi",
  APPROVED: "Disetujui",
  DISBURSED: "Dicairkan",
  REJECTED: "Ditolak",
};

export function disbursementDisplay(
  project: ProjectSnapshot,
): DisbursementDisplay {
  return project.disbursement?.status ?? "NOT_AVAILABLE";
}

export type FinalStatus = "EARLY" | "ON_TIME" | "LATE";

export const FINAL_STATUS_LABELS: Record<FinalStatus, string> = {
  EARLY: "Selesai Lebih Awal",
  ON_TIME: "Selesai Tepat Waktu",
  LATE: "Selesai Terlambat",
};

/**
 * Status Final dari tanggal penutupan dibanding target selesai. Dalam
 * toleransi di sekitar target dianggap tepat waktu (PRD bab 4.12).
 */
export function finalStatusFor(
  closedAt: Date,
  targetEnd: Date,
  toleranceDays: number,
): FinalStatus {
  const diff = daysUntil(targetEnd, closedAt);
  if (diff > toleranceDays) return "EARLY";
  if (diff < -toleranceDays) return "LATE";
  return "ON_TIME";
}
