import { describe, expect, it } from "vitest";
import type { StageDefinition } from "@/lib/project/stages";
import {
  EXPECTED_STAGE_COUNT,
  findStage,
  isKnownStage,
  STAGE_CATALOGUE,
  stageAfter,
} from "@/lib/project/stages";

/** Katalog tiruan, dipakai supaya mesinnya bisa diuji sebelum DEP-04 turun. */
const CONTOH: readonly StageDefinition[] = [
  { key: "tahap_satu", order: 1, label: "Tahap Satu" },
  { key: "tahap_dua", order: 2, label: "Tahap Dua" },
  { key: "tahap_tiga", order: 3, label: "Tahap Tiga" },
];

describe("F09-AC1 Stage mengikuti sebelas tahap IITBOOK.", () => {
  it.todo(
    "Katalog memuat sebelas tahap resmi IITBOOK bab 2.4, menunggu DEP-04 dari COO",
  );

  it("Jumlah tahap yang diharapkan ditetapkan sebagai sebelas", () => {
    expect(EXPECTED_STAGE_COUNT).toBe(11);
  });

  it("Katalog resmi belum lengkap selama DEP-04 belum turun, dan itu terbaca dari kodenya", () => {
    // Sengaja tidak diisi karangan sendiri. PRD bab 3.10 meminta daftar resmi
    // supaya aturan tidak disusun dari asumsi.
    expect(STAGE_CATALOGUE.length).toBeLessThan(EXPECTED_STAGE_COUNT);
  });

  it("Tahap dikenali dari kuncinya", () => {
    expect(isKnownStage(CONTOH, "tahap_dua")).toBe(true);
    expect(isKnownStage(CONTOH, "tahap_entah")).toBe(false);
  });

  it("Tahap yang dicari dikembalikan beserta urutan dan labelnya", () => {
    expect(findStage(CONTOH, "tahap_dua")).toEqual({
      key: "tahap_dua",
      order: 2,
      label: "Tahap Dua",
    });
  });

  it("Tahap yang tidak ada dikembalikan sebagai kosong, bukan ditebak", () => {
    expect(findStage(CONTOH, "tahap_entah")).toBeNull();
  });

  it("Tahap sesudahnya dibaca dari urutannya", () => {
    expect(stageAfter(CONTOH, "tahap_satu")?.key).toBe("tahap_dua");
  });

  it("Tahap terakhir tidak punya tahap sesudahnya", () => {
    expect(stageAfter(CONTOH, "tahap_tiga")).toBeNull();
  });
});
