import type { TerminChainState } from "@/lib/finance/chain";
import { deriveTerminState } from "@/lib/finance/chain";
import type { WorkingHoursConfig } from "@/lib/sla/working-hours";
import {
  DEFAULT_WORKING_HOURS,
  workingMinutesBetween,
} from "@/lib/sla/working-hours";

/**
 * Penyusun baris antrean Finance lintas project (F15).
 *
 * Berkas ini murni dan tidak menyentuh basis data. Yang diuji di sini adalah
 * janji F15: antrean menampilkan nomor, Project ID, client, nominal, jatuh
 * tempo, status, pemegang, dan lama menunggu dalam jam kerja, serta menyembunyikan
 * pengajuan yang sudah ditolak atau sudah lunas.
 *
 * `readFinanceChain` melihat satu project secara utuh. Antrean ini sebaliknya
 * melihat lintas project, hanya baris yang masih menunggu, diurutkan dari yang
 * tertahan paling lama. Keduanya memakai `deriveTerminState` yang sama supaya
 * kata keadaannya tidak pecah dua.
 */

export type InvoiceQueueStatus = "PENDING" | "APPROVED" | "REJECTED";
export type ReceiptQueueStatus = "RECORDED" | "VALID";

/** Status pembayaran yang dibaca manusia dari kuitansi, bukan dari kolom terpisah. */
export type PaymentQueueStatus = "BELUM" | "MENUNGGU" | "RECORDED" | "LUNAS";

export interface FinanceQueueSnapshot {
  invoiceId: string;
  submissionId: string;
  documentNumber: string;
  projectId: string;
  clientName: string;
  amount: string;
  dueDate: Date;
  invoiceStatus: InvoiceQueueStatus;
  receiptStatus: ReceiptQueueStatus | null;
  currentStepLabel: string | null;
  issuedAt: Date;
}

export interface FinanceQueueItem {
  invoiceId: string;
  submissionId: string;
  documentNumber: string;
  projectId: string;
  clientName: string;
  amount: string;
  dueDate: Date;
  approvalStatus: InvoiceQueueStatus;
  paymentStatus: PaymentQueueStatus;
  state: TerminChainState;
  /** Jabatan yang sedang memegang, kosong bila yang ditunggu adalah pembayaran. */
  holdingLabel: string | null;
  waitingSince: Date;
  waitingWorkingMinutes: number;
}

/**
 * Pengajuan yang masih menunggu keputusan, pembayaran, atau verifikasi kuitansi.
 *
 * Ditolak dan lunas keluar dari antrean: yang pertama harus diajukan ulang,
 * yang kedua sudah selesai. Belum ditagihkan tidak pernah masuk karena tidak
 * ada dokumen yang menunggu.
 */
export function belongsInFinanceQueue(state: TerminChainState): boolean {
  return (
    state === "MENUNGGU_PERSETUJUAN" ||
    state === "MENUNGGU_PEMBAYARAN" ||
    state === "MENUNGGU_VERIFIKASI"
  );
}

/**
 * Siapa yang sedang memegang baris ini.
 *
 * Selama rantainya berjalan, pemegangnya adalah langkah yang menunggu
 * keputusan. Setelah disetujui, yang ditunggu adalah pembayaran client, jadi
 * tidak ada approver. Setelah bukti transfer masuk, yang memegang adalah
 * Finance POC yang menyatakan kuitansi valid.
 */
export function holdingLabelOf(
  state: TerminChainState,
  currentStepLabel: string | null,
): string | null {
  if (state === "MENUNGGU_PERSETUJUAN") return currentStepLabel;
  if (state === "MENUNGGU_VERIFIKASI") return "Finance POC";
  return null;
}

export function paymentStatusOf(
  invoiceStatus: InvoiceQueueStatus,
  receiptStatus: ReceiptQueueStatus | null,
): PaymentQueueStatus {
  if (receiptStatus === "VALID") return "LUNAS";
  if (receiptStatus === "RECORDED") return "RECORDED";
  if (invoiceStatus === "APPROVED") return "MENUNGGU";
  return "BELUM";
}

/**
 * Menyusun satu baris antrean, atau `null` bila dokumennya tidak menunggu.
 *
 * Lama menunggu dihitung dari stempel pengajuan invoice, dalam jam kerja
 * (F04), bukan hari kalender, supaya akhir pekan tidak membuat sebuah
 * pengajuan tampak jauh lebih lama tertahan. Issue F15-T01 menyebut "hari
 * kerja"; yang dipakai adalah menit kerja yang sama dengan antrean staffing,
 * bukan penghitung hari kedua yang belum tertulis di PRD.
 */
export function composeFinanceQueueItem(
  snapshot: FinanceQueueSnapshot,
  now: Date,
  workingHours: WorkingHoursConfig = DEFAULT_WORKING_HOURS,
): FinanceQueueItem | null {
  const state = deriveTerminState({
    terminStatus: "UNPAID",
    invoiceStatus: snapshot.invoiceStatus,
    receiptStatus: snapshot.receiptStatus,
  });
  if (!belongsInFinanceQueue(state)) return null;

  return {
    invoiceId: snapshot.invoiceId,
    submissionId: snapshot.submissionId,
    documentNumber: snapshot.documentNumber,
    projectId: snapshot.projectId,
    clientName: snapshot.clientName,
    amount: snapshot.amount,
    dueDate: snapshot.dueDate,
    approvalStatus: snapshot.invoiceStatus,
    paymentStatus: paymentStatusOf(
      snapshot.invoiceStatus,
      snapshot.receiptStatus,
    ),
    state,
    holdingLabel: holdingLabelOf(state, snapshot.currentStepLabel),
    waitingSince: snapshot.issuedAt,
    waitingWorkingMinutes: workingMinutesBetween(
      snapshot.issuedAt,
      now,
      workingHours,
    ),
  };
}
