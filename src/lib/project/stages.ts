/**
 * Katalog tahap project (F09).
 *
 * Tahap disimpan sebagai data, bukan sebagai enum basis data, karena daftar
 * resminya belum turun. Dengan begini pengisian daftar nanti cukup mengubah
 * berkas ini, tanpa migrasi baru dan tanpa menyentuh kode yang memakainya.
 */

export interface StageDefinition {
  /** Kunci yang disimpan di basis data. Tidak pernah berubah setelah dipakai. */
  key: string;
  /** Urutan mulai dari 1, sesuai IITBOOK bab 2.4. */
  order: number;
  /** Nama yang dibaca pengguna. */
  label: string;
}

/** Jumlah tahap menurut IITBOOK bab 2.4. */
export const EXPECTED_STAGE_COUNT = 11;

/**
 * Daftar resmi sebelas tahap, menunggu DEP-04 dari COO.
 *
 * Hanya dua tahap yang namanya disebut PRD bab 3.2, yaitu tahap pertama dan
 * tahap terakhir. Sembilan tahap di antaranya sengaja dibiarkan kosong dan
 * tidak dikarang sendiri, karena PRD bab 3.10 meminta daftar resminya justru
 * supaya aturan tidak disusun dari asumsi.
 *
 * Selama daftarnya belum lengkap, perpindahan tahap hanya mengenali tahap yang
 * tercantum di sini dan menolak sisanya.
 */
export const STAGE_CATALOGUE: readonly StageDefinition[] = [
  { key: "initial_communication", order: 1, label: "Initial Communication" },
  {
    key: "revenue_share_prerequisites",
    order: 11,
    label: "Revenue Share Prerequisites",
  },
];

export function findStage(
  catalogue: readonly StageDefinition[],
  key: string,
): StageDefinition | null {
  return catalogue.find((stage) => stage.key === key) ?? null;
}

export function isKnownStage(
  catalogue: readonly StageDefinition[],
  key: string,
): boolean {
  return findStage(catalogue, key) !== null;
}

/** Tahap tepat sesudahnya menurut urutan, atau kosong bila sudah yang terakhir. */
export function stageAfter(
  catalogue: readonly StageDefinition[],
  key: string,
): StageDefinition | null {
  const current = findStage(catalogue, key);
  if (!current) return null;

  const later = catalogue
    .filter((stage) => stage.order > current.order)
    .sort((a, b) => a.order - b.order);

  return later[0] ?? null;
}
