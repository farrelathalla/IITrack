import { describe, expect, it } from "vitest";
import type { ChainSnapshot } from "@/lib/finance/chain";
import { chainInconsistencies, deriveTerminState } from "@/lib/finance/chain";

function snapshot(overrides: Partial<ChainSnapshot> = {}): ChainSnapshot {
  return {
    terminStatus: "UNPAID",
    invoiceStatus: null,
    receiptStatus: null,
    ...overrides,
  };
}

describe("XC-03-AC1 Happy and rejection paths persist consistent state and append complete audit evidence.", () => {
  it("Termin tanpa invoice belum ditagihkan", () => {
    expect(deriveTerminState(snapshot())).toBe("BELUM_DITAGIHKAN");
  });

  it("Jalur berhasil berjalan dari menunggu persetujuan sampai lunas", () => {
    expect(deriveTerminState(snapshot({ invoiceStatus: "PENDING" }))).toBe(
      "MENUNGGU_PERSETUJUAN",
    );
    expect(deriveTerminState(snapshot({ invoiceStatus: "APPROVED" }))).toBe(
      "MENUNGGU_PEMBAYARAN",
    );
    expect(
      deriveTerminState(
        snapshot({ invoiceStatus: "APPROVED", receiptStatus: "RECORDED" }),
      ),
    ).toBe("MENUNGGU_VERIFIKASI");
    expect(
      deriveTerminState(
        snapshot({
          invoiceStatus: "APPROVED",
          receiptStatus: "VALID",
          terminStatus: "PAID",
        }),
      ),
    ).toBe("LUNAS");
  });

  it("Jalur penolakan berhenti di ditolak, bukan kembali ke belum ditagihkan", () => {
    expect(deriveTerminState(snapshot({ invoiceStatus: "REJECTED" }))).toBe(
      "DITOLAK",
    );
  });

  it("Persetujuan yang belum selesai lebih menentukan daripada bukti transfer yang sudah masuk", () => {
    // Pembayaran client bisa datang sebelum rantainya selesai. Yang menahan
    // terminnya tetap persetujuannya, jadi itu yang ditampilkan.
    expect(
      deriveTerminState(
        snapshot({ invoiceStatus: "PENDING", receiptStatus: "RECORDED" }),
      ),
    ).toBe("MENUNGGU_PERSETUJUAN");
  });

  it("Keadaan jalur berhasil yang utuh tidak dianggap bertentangan", () => {
    expect(
      chainInconsistencies(
        snapshot({
          invoiceStatus: "APPROVED",
          receiptStatus: "VALID",
          terminStatus: "PAID",
        }),
      ),
    ).toEqual([]);
  });

  it("Keadaan jalur penolakan yang utuh tidak dianggap bertentangan", () => {
    expect(
      chainInconsistencies(snapshot({ invoiceStatus: "REJECTED" })),
    ).toEqual([]);
  });

  it("Termin lunas tanpa kuitansi valid tertangkap sebagai pertentangan", () => {
    const masalah = chainInconsistencies(
      snapshot({ terminStatus: "PAID", invoiceStatus: "APPROVED" }),
    );

    expect(masalah).toHaveLength(1);
    expect(masalah[0]).toContain("tidak ada kuitansi yang dinyatakan valid");
  });

  it("Kuitansi valid yang terminnya belum lunas tertangkap sebagai pertentangan", () => {
    const masalah = chainInconsistencies(
      snapshot({ invoiceStatus: "APPROVED", receiptStatus: "VALID" }),
    );

    expect(masalah.join(" ")).toContain("belum berstatus lunas");
  });

  it("Kuitansi tanpa invoice rujukan tertangkap", () => {
    const masalah = chainInconsistencies(
      snapshot({ receiptStatus: "RECORDED" }),
    );

    expect(masalah.join(" ")).toContain("tanpa invoice rujukan");
  });

  it("Kuitansi valid atas invoice yang belum disetujui tertangkap", () => {
    const masalah = chainInconsistencies(
      snapshot({
        invoiceStatus: "PENDING",
        receiptStatus: "VALID",
        terminStatus: "PAID",
      }),
    );

    expect(masalah.join(" ")).toContain("belum disetujui");
  });

  it("Bukti transfer yang menempel pada invoice ditolak tertangkap", () => {
    const masalah = chainInconsistencies(
      snapshot({ invoiceStatus: "REJECTED", receiptStatus: "RECORDED" }),
    );

    expect(masalah.join(" ")).toContain("Invoice yang ditolak");
  });

  it("Setiap keadaan yang mungkin punya kata keadaannya sendiri", () => {
    const semua = new Set<string>();
    for (const terminStatus of ["UNPAID", "PAID"] as const) {
      for (const invoiceStatus of [
        null,
        "PENDING",
        "APPROVED",
        "REJECTED",
      ] as const) {
        for (const receiptStatus of [null, "RECORDED", "VALID"] as const) {
          semua.add(
            deriveTerminState({ terminStatus, invoiceStatus, receiptStatus }),
          );
        }
      }
    }

    expect([...semua].sort()).toEqual([
      "BELUM_DITAGIHKAN",
      "DITOLAK",
      "LUNAS",
      "MENUNGGU_PEMBAYARAN",
      "MENUNGGU_PERSETUJUAN",
      "MENUNGGU_VERIFIKASI",
    ]);
  });
});
