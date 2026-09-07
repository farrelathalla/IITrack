import { describe, expect, it } from "vitest";
import { compareReceiptAmount, verdictForReceipt } from "@/lib/finance/receipt";

const INVOICE = "3000000.00";

describe("F20-AC2 Kuitansi yang nilainya tidak sama dengan invoice rujukannya tidak bisa dinyatakan valid tanpa penyelesaian, dan sistem menampilkan peringatannya.", () => {
  it("Nilai yang sama persis boleh langsung dinyatakan valid", () => {
    const putusan = verdictForReceipt({
      invoiceAmount: INVOICE,
      receiptAmount: "3000000",
    });

    expect(putusan.valid).toBe(true);
    if (!putusan.valid) return;
    expect(putusan.matches).toBe(true);
  });

  it("Selisih tanpa penyelesaian ditolak", () => {
    const putusan = verdictForReceipt({
      invoiceAmount: INVOICE,
      receiptAmount: "2950000",
    });

    expect(putusan.valid).toBe(false);
  });

  it("Penolakannya menyebut selisihnya, bukan hanya bilang tidak cocok", () => {
    const putusan = verdictForReceipt({
      invoiceAmount: INVOICE,
      receiptAmount: "2950000",
    });

    expect(putusan.valid).toBe(false);
    if (putusan.valid) return;
    expect(putusan.reason).toContain("50000.00");
    expect(putusan.reason).toContain("lebih kecil");
    expect(putusan.reason).toContain("3000000.00");
  });

  it("Selisih dengan penyelesaian tertulis boleh dinyatakan valid", () => {
    const putusan = verdictForReceipt({
      invoiceAmount: INVOICE,
      receiptAmount: "2950000",
      resolution: "Selisih 50.000 adalah biaya transfer antarbank.",
    });

    expect(putusan.valid).toBe(true);
    if (!putusan.valid) return;
    expect(putusan.matches).toBe(false);
    expect(putusan.resolution).toBe(
      "Selisih 50.000 adalah biaya transfer antarbank.",
    );
  });

  it("Penyelesaian yang isinya hanya spasi tidak dianggap penyelesaian", () => {
    const putusan = verdictForReceipt({
      invoiceAmount: INVOICE,
      receiptAmount: "2950000",
      resolution: "    ",
    });

    expect(putusan.valid).toBe(false);
  });

  it("Kelebihan bayar juga ditahan, bukan hanya kekurangan", () => {
    const putusan = verdictForReceipt({
      invoiceAmount: INVOICE,
      receiptAmount: "3050000",
    });

    expect(putusan.valid).toBe(false);
    if (putusan.valid) return;
    expect(putusan.reason).toContain("lebih besar");
  });

  it("Selisih satu sen tetap tertangkap", () => {
    const perbandingan = compareReceiptAmount(INVOICE, "3000000.01");

    expect(perbandingan.readable).toBe(true);
    if (!perbandingan.readable) return;
    expect(perbandingan.matches).toBe(false);
    expect(perbandingan.difference).toBe("0.01");
  });

  it("Arah selisih terbaca dari tandanya", () => {
    const kurang = compareReceiptAmount(INVOICE, "2999999.99");
    const lebih = compareReceiptAmount(INVOICE, "3000000.01");

    expect(kurang.readable && kurang.difference).toBe("-0.01");
    expect(lebih.readable && lebih.difference).toBe("0.01");
  });

  it("Nilai yang sama tidak memunculkan peringatan", () => {
    const perbandingan = compareReceiptAmount(INVOICE, "3000000.00");

    expect(perbandingan.readable).toBe(true);
    if (!perbandingan.readable) return;
    expect(perbandingan.matches).toBe(true);
    expect(perbandingan.warning).toBeNull();
  });

  it("Nilai yang tidak masuk akal ditolak sebelum dibandingkan", () => {
    for (const salah of ["0", "-1000", "abc", "3000000.005", ""]) {
      const perbandingan = compareReceiptAmount(INVOICE, salah);
      expect(perbandingan.readable).toBe(false);
    }
  });

  it("Nilai yang membawa galat pecahan biner ditolak, bukan dibulatkan diam-diam", () => {
    // 0.1 + 0.2 menghasilkan 0.30000000000000004. Membulatkannya menjadi 0.30
    // berarti sistem menebak maksud angka uang. Yang benar adalah menolaknya,
    // supaya galatnya ketahuan di tempat asalnya, bukan di kuitansi client.
    const perbandingan = compareReceiptAmount("0.30", 0.1 + 0.2);

    expect(perbandingan.readable).toBe(false);
  });

  it("Nilai rupiah besar dibandingkan tepat sampai sennya", () => {
    const sama = compareReceiptAmount("999999999999.99", "999999999999.99");
    const beda = compareReceiptAmount("999999999999.99", "999999999999.98");

    expect(sama.readable && sama.matches).toBe(true);
    expect(beda.readable && beda.matches).toBe(false);
    expect(beda.readable && beda.difference).toBe("-0.01");
  });
});
