import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { TRACEABILITY } from "../support/traceability";

/**
 * Judul describe yang ada di seluruh berkas test, beserta berkasnya.
 *
 * Dibaca dari berkasnya, bukan dari daftar yang ditulis tangan, supaya matriks
 * ketertelusuran tidak bisa mengaku sebuah criteria tertutup padahal testnya
 * sudah dihapus atau judulnya berubah.
 */
function collectDescribeTitles(): Map<string, string[]> {
  const roots = ["../unit", "../integration"].map((dir) =>
    fileURLToPath(new URL(dir, import.meta.url)),
  );

  const titles = new Map<string, string[]>();
  for (const root of roots) {
    for (const name of readdirSync(root)) {
      if (!name.endsWith(".test.ts")) continue;
      const source = readFileSync(join(root, name), "utf8");
      for (const match of source.matchAll(/describe\(\s*"([^"]+)"/g)) {
        const existing = titles.get(match[1]) ?? [];
        existing.push(name);
        titles.set(match[1], existing);
      }
    }
  }
  return titles;
}

const TITLES = collectDescribeTitles();
const SEMUA_JUDUL = [...TITLES.keys()];

function judulUntuk(id: string): string[] {
  return SEMUA_JUDUL.filter((title) => title.startsWith(`${id} `));
}

const wajibBertest = TRACEABILITY.filter((row) => !row.pending);
const belumDibangun = TRACEABILITY.filter((row) => row.pending);

describe("XC-01-AC2 Every Sprint 1 Must-Have acceptance criterion has a passing automated test and mapped UAT reference.", () => {
  it("Matriks memuat seluruh acceptance criteria Must Have pada PRD bab 4", () => {
    // Angkanya sengaja dipaku. PRD yang bertambah tanpa matriksnya diperbarui
    // akan gagal di sini, bukan lolos diam-diam.
    expect(TRACEABILITY).toHaveLength(52);
  });

  it("Setiap entri punya penanda, kalimat criteria, dan rujukan UAT", () => {
    for (const row of TRACEABILITY) {
      expect(row.id).toMatch(/^F\d{2}-AC\d$/);
      expect(row.criterion.length).toBeGreaterThan(20);
      expect(row.uat).toMatch(/^UAT-/);
    }
  });

  it("Penandanya unik, tidak ada criteria yang tercatat dua kali", () => {
    const ids = TRACEABILITY.map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(
    wajibBertest.map((row) => [row.id, row]),
  )("%s punya test otomatis", (_id, row) => {
    const criterion = row as (typeof TRACEABILITY)[number];
    expect(judulUntuk(criterion.id).length).toBeGreaterThan(0);
  });

  it("Judul describe menyalin kalimat acceptance criteria apa adanya", () => {
    const menyimpang: string[] = [];

    for (const row of wajibBertest) {
      for (const title of judulUntuk(row.id)) {
        const kalimat = title.slice(row.id.length + 1);
        if (kalimat !== row.criterion) {
          menyimpang.push(
            `${row.id}\n    test : ${kalimat}\n    PRD  : ${row.criterion}`,
          );
        }
      }
    }

    expect(menyimpang.join("\n\n")).toBe("");
  });

  it("Criteria yang belum bertest menyebutkan alasannya, bukan dibiarkan kosong", () => {
    for (const row of belumDibangun) {
      expect(row.pending?.length ?? 0).toBeGreaterThan(20);
    }
  });

  it("Criteria yang sudah bertest tidak boleh ditandai belum dibangun", () => {
    const salahTanda = belumDibangun.filter(
      (row) => judulUntuk(row.id).length > 0,
    );

    expect(salahTanda.map((row) => row.id)).toEqual([]);
  });

  it("Tidak ada judul test yang mengaku menutup criteria di luar matriks", () => {
    const dikenal = new Set(TRACEABILITY.map((row) => row.id));
    const liar = SEMUA_JUDUL.map((title) => title.split(" ")[0]).filter(
      (id) => /^F\d{2}-AC\d$/.test(id) && !dikenal.has(id),
    );

    expect([...new Set(liar)]).toEqual([]);
  });
});
