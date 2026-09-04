import { describe, expect, it } from "vitest";
import { evaluateStageTransition } from "@/lib/project/stage-transition";
import type { StageDefinition } from "@/lib/project/stages";

const CONTOH: readonly StageDefinition[] = [
  { key: "tahap_satu", order: 1, label: "Tahap Satu" },
  { key: "tahap_dua", order: 2, label: "Tahap Dua" },
  { key: "tahap_tiga", order: 3, label: "Tahap Tiga" },
];

describe("F09-AC2 Perubahan stage mencatat status lama, status baru, pelaku, dan waktu.", () => {
  it("Perpindahan ke tahap berikutnya dinilai sah", () => {
    const hasil = evaluateStageTransition({
      catalogue: CONTOH,
      from: "tahap_satu",
      to: "tahap_dua",
    });

    expect(hasil.allowed).toBe(true);
  });

  it("Project yang belum punya tahap boleh dipindahkan ke tahap pertama", () => {
    const hasil = evaluateStageTransition({
      catalogue: CONTOH,
      from: null,
      to: "tahap_satu",
    });

    expect(hasil.allowed).toBe(true);
  });

  it("Perpindahan ke tahap yang tidak dikenal ditolak", () => {
    const hasil = evaluateStageTransition({
      catalogue: CONTOH,
      from: "tahap_satu",
      to: "tahap_karangan",
    });

    expect(hasil.allowed).toBe(false);
  });

  it("Perpindahan ke tahap yang sama ditolak, supaya riwayat tidak terisi baris kosong", () => {
    const hasil = evaluateStageTransition({
      catalogue: CONTOH,
      from: "tahap_dua",
      to: "tahap_dua",
    });

    expect(hasil.allowed).toBe(false);
  });

  it("Perpindahan mundur dinilai sah oleh F09, karena penegakan urutan adalah tugas gate F10", () => {
    const hasil = evaluateStageTransition({
      catalogue: CONTOH,
      from: "tahap_tiga",
      to: "tahap_satu",
    });

    expect(hasil.allowed).toBe(true);
  });

  it("Katalog kosong menolak perpindahan apa pun, bukan meloloskannya", () => {
    const hasil = evaluateStageTransition({
      catalogue: [],
      from: null,
      to: "tahap_satu",
    });

    expect(hasil.allowed).toBe(false);
  });

  it("Penolakan menjelaskan alasannya dalam bahasa pengguna", () => {
    const hasil = evaluateStageTransition({
      catalogue: CONTOH,
      from: "tahap_satu",
      to: "tahap_karangan",
    });

    expect(hasil.allowed).toBe(false);
    if (hasil.allowed) return;
    expect(hasil.reason.split(" ").length).toBeGreaterThan(3);
    expect(hasil.reason).not.toMatch(/^[A-Z0-9_]+$/);
  });
});
