/**
 * Penerbitan dan pembacaan Project ID (F05).
 *
 * Fungsi di berkas ini murni dan tidak menyentuh basis data, sehingga aturan
 * penomoran bisa diuji tanpa menyalakan apa pun (PRD bab 3.9). Penjaminan
 * keunikan dan ketiadaan lompatan dilakukan di lapisan basis data, karena
 * hanya di sana dua permintaan bersamaan bisa diurutkan.
 */

const PREFIX = "IIT";

/**
 * Urutan ditulis minimal tiga digit dan dimulai dari 001.
 *
 * Tiga cabangnya: 001 sampai 009, lalu 010 sampai 099, lalu 100 ke atas tanpa
 * nol di depan. Bentuk seperti `000` dan `0042` ditolak polanya sendiri, supaya
 * satu project tidak punya dua tulisan nomor yang sama-sama sah dan supaya
 * basis data serta antarmuka memakai aturan yang sama persis.
 */
export const PROJECT_ID_PATTERN =
  /^IIT-(\d{4})-(0{2}[1-9]|0[1-9]\d|[1-9]\d{2,})$/;

export interface ParsedProjectId {
  period: string;
  sequence: number;
}

/**
 * Menyusun Project ID dari periode kepengurusan dan urutannya.
 *
 * Urutan di atas 999 sengaja tidak dipotong menjadi tiga digit. Memotongnya
 * akan membuat nomor ke-1000 bertabrakan dengan nomor ke-0, dan keunikan lebih
 * penting daripada lebar kolom yang seragam.
 */
export function formatProjectId(period: string, sequence: number): string {
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new Error(
      `Urutan project harus bilangan bulat mulai dari 1, bukan ${sequence}.`,
    );
  }

  return `${PREFIX}-${period}-${String(sequence).padStart(3, "0")}`;
}

/** Mengembalikan `null` bila bentuknya tidak sesuai, bukan menebak maksudnya. */
export function parseProjectId(candidate: string): ParsedProjectId | null {
  const match = PROJECT_ID_PATTERN.exec(candidate);
  if (!match) return null;

  return { period: match[1], sequence: Number(match[2]) };
}

export function isValidProjectId(candidate: string): boolean {
  return parseProjectId(candidate) !== null;
}

/**
 * Urutan berikutnya setelah urutan tertinggi yang pernah terbit.
 *
 * Selalu bergerak maju. Nomor project yang dibatalkan tidak pernah diisi ulang,
 * sehingga sebuah nomor hanya menunjuk satu project selamanya.
 */
export function nextSequence(highestIssued: number): number {
  if (!Number.isInteger(highestIssued) || highestIssued < 0) {
    throw new Error(
      `Urutan tertinggi harus bilangan bulat tidak negatif, bukan ${highestIssued}.`,
    );
  }

  return highestIssued + 1;
}
