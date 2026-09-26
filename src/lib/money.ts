/** "Rp 4.500.000", seperti prototipe. */
export function formatRupiah(amount: number): string {
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

/** Nominal yang tidak boleh dilihat diganti teks ini (PRD bab 2.4). */
export const HIDDEN = "Disembunyikan";
