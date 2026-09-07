/**
 * Keadaan rantai Finance satu termin (XC-03).
 *
 * Termin, invoice, rantai persetujuan, bukti transfer, dan kuitansi masing-masing
 * menyimpan keadaannya sendiri. Berkas ini menerjemahkan gabungan keadaan itu
 * menjadi satu kata yang bisa dibaca manusia, supaya PM dan Finance tidak perlu
 * menyusun sendiri "invoice sudah disetujui tapi kuitansinya belum diverifikasi"
 * dari empat tabel yang berbeda.
 *
 * Berkas ini murni dan tidak menyentuh basis data.
 */

export type TerminChainState =
  /** Belum ada invoice sama sekali. */
  | "BELUM_DITAGIHKAN"
  /** Invoice diajukan, rantai persetujuannya masih berjalan. */
  | "MENUNGGU_PERSETUJUAN"
  /** Invoice terakhir ditolak. Termin ini perlu diajukan ulang. */
  | "DITOLAK"
  /** Invoice disetujui, bukti transfer belum masuk. */
  | "MENUNGGU_PEMBAYARAN"
  /** Bukti transfer sudah masuk, Finance POC belum menyatakannya valid. */
  | "MENUNGGU_VERIFIKASI"
  /** Kuitansi valid dan terminnya lunas. */
  | "LUNAS";

export interface ChainSnapshot {
  terminStatus: "UNPAID" | "PAID";
  /** Invoice terakhir untuk termin ini, atau `null` bila belum pernah ada. */
  invoiceStatus: "PENDING" | "APPROVED" | "REJECTED" | null;
  /** Kuitansi pada invoice terakhir itu, atau `null`. */
  receiptStatus: "RECORDED" | "VALID" | null;
}

/**
 * Kata keadaan untuk satu termin.
 *
 * Keadaan invoice didahulukan selama rantainya belum selesai. Bukti transfer
 * memang bisa masuk sebelum persetujuan selesai, tetapi yang menahan termin
 * tetap persetujuannya, bukan buktinya, jadi itu yang ditampilkan.
 */
export function deriveTerminState(snapshot: ChainSnapshot): TerminChainState {
  if (snapshot.invoiceStatus === null) return "BELUM_DITAGIHKAN";
  if (snapshot.invoiceStatus === "REJECTED") return "DITOLAK";
  if (snapshot.invoiceStatus === "PENDING") return "MENUNGGU_PERSETUJUAN";

  if (snapshot.receiptStatus === "VALID") return "LUNAS";
  if (snapshot.receiptStatus === "RECORDED") return "MENUNGGU_VERIFIKASI";
  return "MENUNGGU_PEMBAYARAN";
}

/**
 * Pertentangan antara keadaan yang saling terkait, kosong bila tidak ada.
 *
 * Dipakai test integrasi XC-03 untuk membuktikan jalur berhasil maupun jalur
 * penolakan meninggalkan keadaan yang tidak saling bertentangan. Dibuat sebagai
 * fungsi, bukan hanya rangkaian assertion di test, supaya aturan konsistensinya
 * tertulis satu kali dan bisa dipanggil dari tempat lain bila perlu.
 */
export function chainInconsistencies(snapshot: ChainSnapshot): string[] {
  const masalah: string[] = [];

  if (snapshot.terminStatus === "PAID" && snapshot.receiptStatus !== "VALID") {
    masalah.push(
      "Termin berstatus lunas padahal tidak ada kuitansi yang dinyatakan valid.",
    );
  }

  if (snapshot.receiptStatus === "VALID" && snapshot.terminStatus !== "PAID") {
    masalah.push(
      "Kuitansi sudah dinyatakan valid tetapi terminnya belum berstatus lunas.",
    );
  }

  if (snapshot.receiptStatus !== null && snapshot.invoiceStatus === null) {
    masalah.push("Ada kuitansi tanpa invoice rujukan.");
  }

  if (
    snapshot.receiptStatus === "VALID" &&
    snapshot.invoiceStatus !== "APPROVED"
  ) {
    masalah.push(
      "Kuitansi dinyatakan valid padahal invoice rujukannya belum disetujui.",
    );
  }

  if (
    snapshot.invoiceStatus === "REJECTED" &&
    snapshot.receiptStatus !== null
  ) {
    masalah.push(
      "Invoice yang ditolak masih punya bukti transfer yang menempel padanya.",
    );
  }

  return masalah;
}
