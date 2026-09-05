/**
 * Nada visual untuk penanda status (Design Brief bab 4).
 *
 * Dipisah dari komponen React supaya pemetaan status bisnis → tampilan bisa
 * diuji tanpa merender DOM, dan supaya halaman tidak mengarang kelas Tailwind
 * sendiri tiap kali menampilkan status.
 */

export type StatusTone =
  | "neutral"
  | "running"
  | "pending"
  | "success"
  | "danger";

/**
 * Kelas Tailwind untuk tiap nada. Warna diambil dari token IIT di globals.css,
 * bukan hijau/merah bawaan framework.
 */
export const STATUS_TONE_CLASS: Record<StatusTone, string> = {
  neutral: "bg-surface text-slate-500 border-line",
  running: "bg-plum-50 text-plum-900 border-plum-400/30",
  pending: "bg-amber-bg text-amber-text border-amber-text/20",
  success: "bg-success-bg text-success-text border-success-text/20",
  danger: "bg-danger-bg text-danger-text border-danger-text/20",
};

/**
 * Kata status yang sering muncul di IITrack → nada visual.
 *
 * Sengaja longgar (huruf kecil, strip/spasi) supaya pemanggil UI tidak harus
 * mengingat ejaan enum. Status yang tidak dikenal jatuh ke `neutral`.
 */
const KNOWN: Record<string, StatusTone> = {
  invited: "pending",
  active: "running",
  deactivated: "neutral",
  draft: "neutral",
  menunggu: "pending",
  pending: "pending",
  waiting: "pending",
  disetujui: "success",
  approved: "success",
  lunas: "success",
  selesai: "success",
  closed: "success",
  ditolak: "danger",
  rejected: "danger",
  gagal: "danger",
  overdue: "danger",
  terlambat: "danger",
  berjalan: "running",
  in_progress: "running",
  assigned: "running",
};

export function normalizeStatusKey(status: string): string {
  return status
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, "_");
}

export function toneForStatus(status: string): StatusTone {
  return KNOWN[normalizeStatusKey(status)] ?? "neutral";
}
