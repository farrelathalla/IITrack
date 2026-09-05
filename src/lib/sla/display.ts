import type { StatusTone } from "@/lib/ui/status";
import {
  DEFAULT_WORKING_HOURS,
  evaluateSla,
  SLA_PM_ASSIGNMENT_MINUTES,
  type SlaEvaluation,
  type WorkingHoursConfig,
} from "./working-hours";

/**
 * Mengubah menit kerja menjadi teks singkat berbahasa Indonesia.
 * Contoh: 150 → "2 jam 30 menit kerja".
 */
export function formatWorkingDuration(totalMinutes: number): string {
  if (!Number.isFinite(totalMinutes) || totalMinutes < 0) {
    return "0 menit kerja";
  }

  const minutes = Math.round(totalMinutes);
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;

  if (hours === 0) return `${remainder} menit kerja`;
  if (remainder === 0) return `${hours} jam kerja`;
  return `${hours} jam ${remainder} menit kerja`;
}

export interface PmAssignmentSlaView {
  evaluation: SlaEvaluation;
  thresholdLabel: string;
  elapsedLabel: string;
  badgeLabel: string;
  tone: StatusTone;
  /** Kalimat ringkas untuk ditampilkan di samping badge. */
  summary: string;
}

/**
 * Menyusun model tampilan SLA penugasan PM dari dua stempel waktu.
 *
 * Mengembalikan `null` bila salah satu stempel belum ada — UI boleh bilang
 * "belum bisa diukur" alih-alih menampilkan angka nol yang menyesatkan.
 */
export function buildPmAssignmentSlaView(input: {
  clientConfirmedAt: Date | null | undefined;
  pmAssignedAt: Date | null | undefined;
  thresholdMinutes?: number;
  workingHours?: WorkingHoursConfig;
}): PmAssignmentSlaView | null {
  const { clientConfirmedAt, pmAssignedAt } = input;
  if (!clientConfirmedAt || !pmAssignedAt) return null;

  const threshold = input.thresholdMinutes ?? SLA_PM_ASSIGNMENT_MINUTES;
  const evaluation = evaluateSla(
    clientConfirmedAt,
    pmAssignedAt,
    threshold,
    input.workingHours ?? DEFAULT_WORKING_HOURS,
  );

  const thresholdLabel = formatWorkingDuration(threshold);
  const elapsedLabel = formatWorkingDuration(evaluation.workingMinutes);

  if (evaluation.withinThreshold) {
    return {
      evaluation,
      thresholdLabel,
      elapsedLabel,
      badgeLabel: "Dalam SLA",
      tone: "success",
      summary: `Penugasan selesai dalam ${elapsedLabel} (ambang ${thresholdLabel}).`,
    };
  }

  return {
    evaluation,
    thresholdLabel,
    elapsedLabel,
    badgeLabel: "Terlambat",
    tone: "danger",
    summary: `Penugasan memakan ${elapsedLabel}, lewat ${formatWorkingDuration(evaluation.overdueMinutes)} dari ambang ${thresholdLabel}.`,
  };
}
