import { parseScaledDecimal } from "@/lib/termin/scheme";

/**
 * Pencocokan nilai kuitansi terhadap invoice rujukannya (F20).
 *
 * Berkas ini murni dan tidak menyentuh basis data. Perbandingannya memakai
 * bilangan bulat berskala, bukan bilangan pecahan biner, karena selisih satu
 * sen pada nilai ratusan juta harus tetap tertangkap. `0.1 + 0.2` sudah cukup
 * untuk membuktikan bahwa pecahan biner tidak bisa dipakai menghitung uang.
 */

export type AmountComparison =
  | { readable: false; reason: string }
  | {
      readable: true;
      matches: boolean;
      /** Selisih kuitansi terhadap invoice, positif berarti kuitansi lebih besar. */
      difference: string;
      /** Peringatan yang siap ditampilkan, kosong bila nilainya sama. */
      warning: string | null;
    };

function formatAmount(value: bigint): string {
  const negatif = value < BigInt(0);
  const mutlak = negatif ? -value : value;
  const utuh = mutlak / BigInt(100);
  const sen = (mutlak % BigInt(100)).toString().padStart(2, "0");
  return `${negatif ? "-" : ""}${utuh.toString()}.${sen}`;
}

/**
 * Membandingkan nilai kuitansi dengan nilai invoice rujukannya.
 *
 * Yang dikembalikan bukan sekadar benar atau salah, melainkan selisihnya juga,
 * supaya Finance POC bisa melihat kurang atau lebih berapa tanpa menghitung
 * sendiri. Ini yang dimaksud PRD dengan "sistem menampilkan peringatannya".
 */
export function compareReceiptAmount(
  invoiceAmount: string | number,
  receiptAmount: string | number,
): AmountComparison {
  const invoice = parseScaledDecimal(invoiceAmount, 2);
  const receipt = parseScaledDecimal(receiptAmount, 2);

  if (invoice === null) {
    return { readable: false, reason: "Nilai invoice rujukan tidak terbaca." };
  }
  if (receipt === null) {
    return {
      readable: false,
      reason:
        "Nilai kuitansi hanya boleh sampai dua angka di belakang koma, misalnya 3000000 atau 3000000.50.",
    };
  }
  if (receipt <= BigInt(0)) {
    return {
      readable: false,
      reason: "Nilai kuitansi harus lebih besar dari nol.",
    };
  }

  const selisih = receipt - invoice;
  if (selisih === BigInt(0)) {
    return {
      readable: true,
      matches: true,
      difference: "0.00",
      warning: null,
    };
  }

  const arah = selisih > BigInt(0) ? "lebih besar" : "lebih kecil";
  return {
    readable: true,
    matches: false,
    difference: formatAmount(selisih),
    warning:
      `Nilai kuitansi ${formatAmount(receipt)} ${arah} ${formatAmount(selisih > BigInt(0) ? selisih : -selisih)} ` +
      `daripada invoice rujukannya yang bernilai ${formatAmount(invoice)}.`,
  };
}

export interface ValidationInput {
  invoiceAmount: string | number;
  receiptAmount: string | number;
  /** Penjelasan tertulis atas selisih, bila ada selisihnya. */
  resolution?: string | null;
}

export type ValidationVerdict =
  | { valid: true; matches: boolean; resolution: string | null }
  | { valid: false; reason: string };

/**
 * Apakah sebuah kuitansi boleh dinyatakan valid.
 *
 * Selisih tidak dilarang, karena pembayaran client memang bisa berbeda karena
 * biaya transfer atau pembulatan. Yang dilarang adalah menyatakannya valid
 * tanpa penyelesaian tertulis: selisih harus dijelaskan lebih dulu supaya
 * angkanya tidak diam-diam berbeda saat dokumennya sampai ke client
 * (PRD F20, UAT-NFR-007).
 */
export function verdictForReceipt(input: ValidationInput): ValidationVerdict {
  const perbandingan = compareReceiptAmount(
    input.invoiceAmount,
    input.receiptAmount,
  );
  if (!perbandingan.readable) {
    return { valid: false, reason: perbandingan.reason };
  }

  const resolution = input.resolution?.trim() || null;

  if (perbandingan.matches) {
    return { valid: true, matches: true, resolution };
  }

  if (!resolution) {
    return {
      valid: false,
      reason: `${perbandingan.warning} Kuitansi dengan selisih hanya bisa dinyatakan valid bila penyelesaiannya ditulis lebih dulu.`,
    };
  }

  return { valid: true, matches: false, resolution };
}
