import { formatDocumentNumber } from "@/lib/document/numbering";

/**
 * Penyusun isi invoice per termin (F16).
 *
 * Berkas ini murni dan tidak menyentuh basis data. Yang diuji di sini adalah
 * janji utama F16: Project ID, client, dan nilai terisi sendiri dari data yang
 * sudah ada, sedangkan yang boleh diketik manusia hanya keterangan. Karena itu
 * pengisian otomatis dan isian manual sengaja masuk lewat dua parameter yang
 * berbeda, sehingga pemanggil tidak punya cara menimpa angka tagihan.
 */

export interface InvoiceProjectSource {
  /** Nomor resmi berformat IIT-2627-NNN. */
  projectId: string;
  name: string;
  /** Nama client terkini, dari master data bila project merujuk ke sana. */
  clientName: string;
}

export interface InvoiceTerminSource {
  sequence: number;
  percentage: string;
  amount: string;
  dueDate: Date;
  status: "UNPAID" | "PAID";
}

/** Satu-satunya bagian invoice yang diketik manusia. */
export interface InvoiceManualInput {
  description?: string | null;
  notes?: string | null;
}

export interface InvoiceDraft {
  number: string;
  projectId: string;
  projectName: string;
  clientName: string;
  terminSequence: number;
  terminPercentage: string;
  amount: string;
  dueDate: Date;
  description: string | null;
  notes: string | null;
}

export type InvoiceDraftResult =
  | { ok: true; draft: InvoiceDraft }
  | { ok: false; reason: string };

function trimToNull(value: string | null | undefined): string | null {
  const text = value?.trim();
  return text ? text : null;
}

/**
 * Menyusun invoice satu termin dari data project dan termin yang sudah ada.
 *
 * Termin yang sudah lunas ditolak di sini, bukan hanya disembunyikan dari
 * daftar pilihan, supaya permintaan langsung ke server tetap ditolak.
 */
export function buildInvoiceDraft(input: {
  project: InvoiceProjectSource;
  termin: InvoiceTerminSource;
  manual?: InvoiceManualInput;
}): InvoiceDraftResult {
  const { project, termin } = input;

  if (termin.status === "PAID") {
    return {
      ok: false,
      reason: `Termin ${termin.sequence} sudah lunas, jadi tidak perlu ditagihkan lagi.`,
    };
  }

  let number: string;
  try {
    number = formatDocumentNumber("INVOICE", project.projectId);
  } catch {
    return {
      ok: false,
      reason:
        "Nomor project belum sesuai format resmi, jadi nomor invoicenya belum bisa diterbitkan.",
    };
  }

  return {
    ok: true,
    draft: {
      number,
      projectId: project.projectId,
      projectName: project.name,
      clientName: project.clientName,
      terminSequence: termin.sequence,
      terminPercentage: termin.percentage,
      amount: termin.amount,
      dueDate: termin.dueDate,
      description: trimToNull(input.manual?.description),
      notes: trimToNull(input.manual?.notes),
    },
  };
}

/** Invoice yang sudah pernah dibuat untuk sebuah termin. */
export interface ExistingInvoice {
  terminSequence: number;
  submissionStatus: "PENDING" | "APPROVED" | "REJECTED";
  /** Nama langkah yang sedang menunggu keputusan, bila masih berjalan. */
  currentStepLabel?: string | null;
}

/**
 * Alasan sebuah termin tidak boleh diajukan lagi, atau `null` bila boleh.
 *
 * Yang menahan hanya pengajuan yang masih hidup: yang menunggu keputusan, dan
 * yang sudah disetujui. Pengajuan yang ditolak tidak menahan, karena PM memang
 * harus bisa mengajukan ulang setelah perbaikan (F17-AC3).
 */
export function reasonTerminCannotBeInvoiced(
  existing: readonly ExistingInvoice[],
  terminSequence: number,
): string | null {
  const menunggu = existing.find(
    (invoice) =>
      invoice.terminSequence === terminSequence &&
      invoice.submissionStatus === "PENDING",
  );
  if (menunggu) {
    const langkah = menunggu.currentStepLabel;
    return langkah
      ? `Termin ${terminSequence} masih punya pengajuan invoice yang menunggu keputusan ${langkah}, jadi belum bisa diajukan lagi.`
      : `Termin ${terminSequence} masih punya pengajuan invoice yang belum selesai diproses, jadi belum bisa diajukan lagi.`;
  }

  const disetujui = existing.find(
    (invoice) =>
      invoice.terminSequence === terminSequence &&
      invoice.submissionStatus === "APPROVED",
  );
  if (disetujui) {
    return `Termin ${terminSequence} sudah punya invoice yang disetujui, jadi tidak bisa diajukan lagi.`;
  }

  return null;
}
