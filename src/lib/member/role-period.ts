/**
 * Aturan masa berlaku jabatan (F07).
 *
 * Batasnya ditetapkan sebagai setengah terbuka: tanggal mulai termasuk, tanggal
 * selesai tidak. Pilihan itu yang membuat serah terima bisa menutup masa
 * jabatan lama dan membuka yang baru pada saat yang sama persis, tanpa celah
 * dan tanpa tumpang tindih.
 */

export interface PeriodRange {
  startDate: Date;
  /** Kosong berarti belum ditentukan, bukan berlaku selamanya secara sengaja. */
  endDate: Date | null;
}

export type PeriodValidation =
  | { valid: true }
  | { valid: false; reason: string };

export function validatePeriod(range: PeriodRange): PeriodValidation {
  if (range.endDate === null) return { valid: true };

  if (range.endDate.getTime() <= range.startDate.getTime()) {
    return {
      valid: false,
      reason:
        "Tanggal selesai masa jabatan harus setelah tanggal mulainya, karena periode yang tidak punya rentang tidak pernah memberi kewenangan apa pun.",
    };
  }

  return { valid: true };
}

/** Batas akhir efektif sebuah periode; tanpa tanggal selesai berarti tak terhingga. */
function effectiveEnd(range: PeriodRange): number {
  return range.endDate?.getTime() ?? Number.POSITIVE_INFINITY;
}

/**
 * Apakah dua periode beririsan.
 *
 * Periode yang bersambung ujung ke ujung tidak dihitung bertabrakan, karena
 * tanggal selesai bersifat eksklusif.
 */
export function overlaps(a: PeriodRange, b: PeriodRange): boolean {
  return (
    a.startDate.getTime() < effectiveEnd(b) &&
    b.startDate.getTime() < effectiveEnd(a)
  );
}

export interface HandoverBoundary {
  /** Saat masa jabatan lama ditutup, tidak termasuk. */
  closesAt: Date;
  /** Saat masa jabatan baru dibuka, termasuk. */
  opensAt: Date;
}

/**
 * Titik serah terima. Keduanya sengaja bernilai sama supaya kewenangan
 * berpindah tanpa menyisakan satu detik pun tanpa penanggung jawab, dan tanpa
 * satu detik pun dipegang dua orang sekaligus.
 */
export function handoverBoundary(effectiveAt: Date): HandoverBoundary {
  return { closesAt: new Date(effectiveAt), opensAt: new Date(effectiveAt) };
}
