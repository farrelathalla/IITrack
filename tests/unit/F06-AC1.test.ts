import { describe, expect, it } from "vitest";
import {
  clientDraftsEqual,
  normalizeClientDraft,
  normalizeNpwp,
} from "@/lib/client/profile";

describe("F06-AC1 Client tersimpan sebagai master data dan bisa dipilih saat membuat project.", () => {
  it("UAT-CLIENT-002, nama wajib dan isian opsional dikosongkan jadi null", () => {
    const hasil = normalizeClientDraft({
      name: "  HMIF ITB  ",
      contact: " ",
      address: "",
      npwp: null,
    });

    expect(hasil.valid).toBe(true);
    if (!hasil.valid) return;
    expect(hasil.value).toEqual({
      name: "HMIF ITB",
      contact: null,
      address: null,
      npwp: null,
    });
  });

  it("Nama kosong ditolak", () => {
    const hasil = normalizeClientDraft({ name: "   " });
    expect(hasil.valid).toBe(false);
    if (hasil.valid) return;
    expect(hasil.reason.split(" ").length).toBeGreaterThan(2);
  });

  it("NPWP resmi dengan titik dan strip diterima sebagai digit", () => {
    expect(normalizeNpwp("01.234.567.8-901.000")).toEqual({
      ok: true,
      value: "012345678901000",
    });
  });

  it("NPWP yang bukan 15 atau 16 digit ditolak", () => {
    const hasil = normalizeClientDraft({
      name: "PT Contoh",
      npwp: "123",
    });
    expect(hasil.valid).toBe(false);
  });
});

describe("F06-AC2 Perubahannya berlaku pada seluruh project yang merujuknya dan masuk audit log.", () => {
  it("Dua potret yang isinya sama dianggap tidak berubah", () => {
    const potret = {
      name: "HMIF ITB",
      contact: "a@b.test",
      address: "Bandung",
      npwp: "123456789012000",
    };
    expect(clientDraftsEqual(potret, { ...potret })).toBe(true);
    expect(clientDraftsEqual(potret, { ...potret, name: "HMIF" })).toBe(false);
  });
});
