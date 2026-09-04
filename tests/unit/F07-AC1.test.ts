import { describe, expect, it } from "vitest";
import {
  handoverBoundary,
  overlaps,
  validatePeriod,
} from "@/lib/member/role-period";

const AWAL = new Date("2026-08-01T00:00:00.000Z");
const AKHIR = new Date("2027-08-01T00:00:00.000Z");

describe("F07-AC1 Jabatan hanya berlaku di dalam periodenya.", () => {
  it("Periode dengan tanggal mulai sebelum tanggal selesai dinilai sah", () => {
    expect(validatePeriod({ startDate: AWAL, endDate: AKHIR }).valid).toBe(
      true,
    );
  });

  it("Periode tanpa tanggal selesai dinilai sah, karena berarti belum ditentukan", () => {
    expect(validatePeriod({ startDate: AWAL, endDate: null }).valid).toBe(true);
  });

  it("Tanggal selesai sebelum tanggal mulai ditolak", () => {
    const hasil = validatePeriod({ startDate: AKHIR, endDate: AWAL });

    expect(hasil.valid).toBe(false);
    if (hasil.valid) return;
    expect(hasil.reason.split(" ").length).toBeGreaterThan(3);
  });

  it("Periode berdurasi nol ditolak, karena tidak pernah memberi kewenangan apa pun", () => {
    expect(validatePeriod({ startDate: AWAL, endDate: AWAL }).valid).toBe(
      false,
    );
  });

  it("Dua periode yang beririsan dikenali sebagai bertabrakan", () => {
    const a = { startDate: AWAL, endDate: AKHIR };
    const b = {
      startDate: new Date("2027-01-01T00:00:00.000Z"),
      endDate: new Date("2028-01-01T00:00:00.000Z"),
    };

    expect(overlaps(a, b)).toBe(true);
  });

  it("Periode yang bersambung ujung ke ujung tidak dianggap bertabrakan", () => {
    // Ini sifat yang dipakai serah terima: masa jabatan lama ditutup tepat pada
    // saat masa jabatan baru dibuka, tanpa celah dan tanpa tumpang tindih.
    const lama = { startDate: AWAL, endDate: AKHIR };
    const baru = { startDate: AKHIR, endDate: null };

    expect(overlaps(lama, baru)).toBe(false);
  });

  it("Periode tanpa tanggal selesai bertabrakan dengan periode mana pun sesudahnya", () => {
    const terbuka = { startDate: AWAL, endDate: null };
    const sesudahnya = {
      startDate: new Date("2030-01-01T00:00:00.000Z"),
      endDate: null,
    };

    expect(overlaps(terbuka, sesudahnya)).toBe(true);
  });

  it("Periode yang sepenuhnya terpisah tidak bertabrakan", () => {
    const a = { startDate: AWAL, endDate: AKHIR };
    const b = {
      startDate: new Date("2028-01-01T00:00:00.000Z"),
      endDate: new Date("2029-01-01T00:00:00.000Z"),
    };

    expect(overlaps(a, b)).toBe(false);
  });

  it("Batas serah terima menutup dan membuka pada saat yang sama persis", () => {
    const batas = handoverBoundary(AKHIR);

    expect(batas.closesAt.getTime()).toBe(AKHIR.getTime());
    expect(batas.opensAt.getTime()).toBe(AKHIR.getTime());
  });

  it("Masa jabatan lama dan baru hasil serah terima tidak bertabrakan", () => {
    const batas = handoverBoundary(AKHIR);
    const lama = { startDate: AWAL, endDate: batas.closesAt };
    const baru = { startDate: batas.opensAt, endDate: null };

    expect(overlaps(lama, baru)).toBe(false);
  });
});
