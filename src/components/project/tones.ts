import type { Tone } from "@/components/ui/badge";
import type { TermStatus } from "@/lib/finance/terms";
import type { DisbursementDisplay } from "@/lib/project/closure";
import type { StageStatus } from "@/lib/project/stages";
import type { ProjectStatus, Urgency } from "@/lib/project/status";

/** Warna status stage (PRD bab 4.2). */
export const STAGE_TONE: Record<StageStatus, Tone> = {
  locked: "neutral",
  "not-started": "neutral",
  "in-progress": "brand",
  "waiting-approval": "warning",
  "revision-required": "danger",
  approved: "success",
  completed: "success",
};

/** Warna status project (PRD bab 9). */
export const PROJECT_TONE: Record<ProjectStatus, Tone> = {
  ACTION_REQUIRED: "danger",
  WAITING_APPROVAL: "warning",
  AT_RISK: "warning",
  ON_TRACK: "success",
};

/** Garis atas kartu project sesuai status. */
export const PROJECT_TOP_BAR: Record<ProjectStatus, string> = {
  ACTION_REQUIRED: "bg-red-500",
  WAITING_APPROVAL: "bg-warning-dot",
  AT_RISK: "bg-warning-dot",
  ON_TRACK: "bg-plum-600",
};

export const URGENCY_TONE: Record<Urgency, { bar: string; tone: Tone }> = {
  overdue: { bar: "bg-danger-dot", tone: "danger" },
  today: { bar: "bg-warning-dot", tone: "warning" },
  tomorrow: { bar: "bg-warning-dot", tone: "warning" },
  soon: { bar: "bg-warning-dot", tone: "warning" },
  normal: { bar: "bg-success-line", tone: "neutral" },
};

export const TERM_STATUS_TONE: Record<TermStatus, Tone> = {
  NOT_DUE: "neutral",
  IN_PROGRESS: "warning",
  OVERDUE: "danger",
  PAID: "success",
};

export const DISBURSEMENT_TONE: Record<DisbursementDisplay, Tone> = {
  NOT_AVAILABLE: "neutral",
  SUBMITTED: "warning",
  VERIFIED: "warning",
  APPROVED: "success",
  DISBURSED: "success",
  REJECTED: "danger",
};

/** Warna badge untuk label status kecil (invoice, pembayaran, kwitansi). */
export function labelTone(label: string): Tone {
  if (
    [
      "Disetujui",
      "Lunas",
      "Diterbitkan",
      "Selesai",
      "Ditandatangani",
      "Dikirim ke Client",
      "Aktif",
      "Lulus",
      "Dicairkan",
    ].includes(label)
  ) {
    return "success";
  }
  if (
    [
      "Diminta",
      "Diproses",
      "Menunggu Verifikasi",
      "Diajukan",
      "Menunggu",
      "Dijadwalkan",
      "Belum Lunas",
      "Dalam Proses",
      "Menunggu TechDev",
    ].includes(label)
  ) {
    return "warning";
  }
  if (
    [
      "Ditolak",
      "Revisi Diperlukan",
      "Overdue",
      "Perlu Perbaikan",
      "Belum Ada",
    ].includes(label)
  ) {
    return "danger";
  }
  return "neutral";
}
