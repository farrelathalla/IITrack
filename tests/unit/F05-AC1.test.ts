import { describe, expect, it } from "vitest";
import {
  formatProjectId,
  nextSequence,
  PROJECT_ID_PATTERN,
  parseProjectId,
} from "@/lib/project/project-id";

describe("F05-AC1 Project ID berformat IIT-2627-NNN, berurutan tanpa lompatan, dan tidak pernah didaur ulang termasuk untuk project yang dibatalkan.", () => {
  it("Nomor pertama sebuah periode adalah IIT-2627-001", () => {
    expect(formatProjectId("2627", 1)).toBe("IIT-2627-001");
  });

  it("Urutan diisi nol di depan sampai tiga digit", () => {
    expect(formatProjectId("2627", 7)).toBe("IIT-2627-007");
    expect(formatProjectId("2627", 42)).toBe("IIT-2627-042");
    expect(formatProjectId("2627", 100)).toBe("IIT-2627-100");
  });

  it("Urutan di atas 999 tidak dipotong, supaya nomor tetap unik walau formatnya melebar", () => {
    expect(formatProjectId("2627", 1000)).toBe("IIT-2627-1000");
  });

  it("Nomor berurutan tanpa lompatan, bertambah tepat satu setiap kali terbit", () => {
    let sequence = 0;
    const issued: string[] = [];

    for (let i = 0; i < 5; i++) {
      sequence = nextSequence(sequence);
      issued.push(formatProjectId("2627", sequence));
    }

    expect(issued).toEqual([
      "IIT-2627-001",
      "IIT-2627-002",
      "IIT-2627-003",
      "IIT-2627-004",
      "IIT-2627-005",
    ]);
  });

  it("Nomor project yang dibatalkan tidak dipakai ulang, karena urutan hanya bergerak maju", () => {
    // Project bernomor 003 dibatalkan. Penerbitan berikutnya tetap melanjutkan
    // dari urutan tertinggi yang pernah terbit, bukan mengisi lubangnya.
    const tertinggiYangPernahTerbit = 3;

    expect(
      formatProjectId("2627", nextSequence(tertinggiYangPernahTerbit)),
    ).toBe("IIT-2627-004");
  });

  it("Format yang benar dapat diurai kembali menjadi periode dan urutannya", () => {
    expect(parseProjectId("IIT-2627-042")).toEqual({
      period: "2627",
      sequence: 42,
    });
  });

  it("Format yang salah ditolak, bukan diterima diam-diam", () => {
    for (const salah of [
      "IIT-2627-42",
      "IIT-2627-0042",
      "IIT-26270-042",
      "iit-2627-042",
      "IIT2627042",
      "IIT-2627-000",
      "IIT-2627-abc",
      "",
      "IIT-2627-042 ",
    ]) {
      expect(parseProjectId(salah)).toBeNull();
    }
  });

  it("Pola yang dipakai basis data dan antarmuka berasal dari satu sumber yang sama", () => {
    expect(PROJECT_ID_PATTERN.test("IIT-2627-001")).toBe(true);
    expect(PROJECT_ID_PATTERN.test("IIT-2627-000")).toBe(false);
  });

  it("Urutan nol atau negatif ditolak, karena penomoran dimulai dari satu", () => {
    expect(() => formatProjectId("2627", 0)).toThrow();
    expect(() => formatProjectId("2627", -1)).toThrow();
  });
});
