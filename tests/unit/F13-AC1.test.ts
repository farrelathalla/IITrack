import { describe, expect, it } from "vitest";
import { MAX_TERMIN_ROWS, validateTerminScheme } from "@/lib/termin/scheme";

const JATUH_TEMPO = new Date("2026-10-01T00:00:00.000Z");
const JATUH_TEMPO_DUA = new Date("2026-11-01T00:00:00.000Z");
const NILAI = "10000000.00";

function skema(
  drafts: Parameters<typeof validateTerminScheme>[0]["drafts"],
  nilai: string | number | null | undefined = NILAI,
) {
  return validateTerminScheme({ projectValue: nilai, drafts });
}

describe("F13-AC1 Termin memuat nomor, persentase atau nominal, dan jatuh tempo.", () => {
  it("UAT-TERM-001, skema sah menyimpan nomor, persentase, nominal, dan jatuh tempo", () => {
    const hasil = skema([
      { sequence: 1, percentage: "30", dueDate: JATUH_TEMPO },
      { sequence: 2, percentage: "70", dueDate: JATUH_TEMPO_DUA },
    ]);

    expect(hasil.valid).toBe(true);
    if (!hasil.valid) return;
    expect(hasil.termins).toHaveLength(2);
    expect(hasil.termins[0]).toMatchObject({
      sequence: 1,
      percentage: "30.00",
      amount: "3000000.00",
    });
    expect(hasil.termins[0].dueDate.getTime()).toBe(JATUH_TEMPO.getTime());
    expect(hasil.termins[1].amount).toBe("7000000.00");
  });

  it("Nominal saja dihitung menjadi persentase dari nilai project", () => {
    const hasil = skema([
      { sequence: 1, amount: "3000000", dueDate: JATUH_TEMPO },
      { sequence: 2, amount: "7000000", dueDate: JATUH_TEMPO_DUA },
    ]);

    expect(hasil.valid).toBe(true);
    if (!hasil.valid) return;
    expect(hasil.termins[0].percentage).toBe("30.00");
    expect(hasil.termins[1].percentage).toBe("70.00");
  });

  it("Persentase dan nominal yang keduanya diisi harus cocok", () => {
    const hasil = skema([
      {
        sequence: 1,
        percentage: "30",
        amount: "2500000",
        dueDate: JATUH_TEMPO,
      },
      { sequence: 2, percentage: "70", dueDate: JATUH_TEMPO_DUA },
    ]);

    expect(hasil.valid).toBe(false);
  });

  it("Termin tanpa persentase dan tanpa nominal ditolak", () => {
    const hasil = skema([
      { sequence: 1, dueDate: JATUH_TEMPO },
      { sequence: 2, percentage: "70", dueDate: JATUH_TEMPO_DUA },
    ]);

    expect(hasil.valid).toBe(false);
    if (hasil.valid) return;
    expect(hasil.reason.split(" ").length).toBeGreaterThan(4);
  });

  it("Termin tanpa jatuh tempo ditolak", () => {
    const hasil = skema([
      { sequence: 1, percentage: "30", dueDate: "bukan-tanggal" },
      { sequence: 2, percentage: "70", dueDate: JATUH_TEMPO_DUA },
    ]);

    expect(hasil.valid).toBe(false);
  });

  it("Tanpa nilai project skema tidak dihitung", () => {
    const hasil = skema(
      [{ sequence: 1, percentage: "30", dueDate: JATUH_TEMPO }],
      null,
    );

    expect(hasil.valid).toBe(false);
  });

  it("Nomor yang meloncat atau tidak mulai dari satu ditolak", () => {
    const meloncat = skema([
      { sequence: 1, percentage: "30", dueDate: JATUH_TEMPO },
      { sequence: 3, percentage: "70", dueDate: JATUH_TEMPO_DUA },
    ]);
    const mulaiDua = skema([
      { sequence: 2, percentage: "30", dueDate: JATUH_TEMPO },
      { sequence: 3, percentage: "70", dueDate: JATUH_TEMPO_DUA },
    ]);

    expect(meloncat.valid).toBe(false);
    expect(mulaiDua.valid).toBe(false);
  });
});

// PRD F13-AC2 memuat dua larangan dalam satu kalimat. Keduanya diuji
// terpisah di sini, jadi dua describe berbagi judul acceptance criteria
// yang sama; itu disengaja, bukan salin tempel.
describe("F13-AC2 Sistem menolak skema yang jumlah persentasenya bukan seratus, dan menolak termin pertama di luar rentang 25 sampai 50 persen.", () => {
  it("UAT-TERM-002, jumlah 90 persen ditolak", () => {
    const hasil = skema([
      { sequence: 1, percentage: "30", dueDate: JATUH_TEMPO },
      { sequence: 2, percentage: "60", dueDate: JATUH_TEMPO_DUA },
    ]);

    expect(hasil.valid).toBe(false);
    if (hasil.valid) return;
    expect(hasil.reason).toContain("100");
  });

  it("Jumlah tepat 100 persen diterima, termasuk pecahan dua desimal", () => {
    const hasil = skema([
      { sequence: 1, percentage: "33.33", dueDate: JATUH_TEMPO },
      { sequence: 2, percentage: "33.33", dueDate: JATUH_TEMPO_DUA },
      {
        sequence: 3,
        percentage: "33.34",
        dueDate: new Date("2026-12-01T00:00:00.000Z"),
      },
    ]);

    expect(hasil.valid).toBe(true);
  });

  it("Skema kosong ditolak, bukan dianggap lolos karena tidak ada yang dijumlahkan", () => {
    expect(skema([]).valid).toBe(false);
  });

  it("Skema yang barisnya melebihi batas ditolak sebelum isinya dihitung", () => {
    const kebanyakan = Array.from(
      { length: MAX_TERMIN_ROWS + 1 },
      (_, index) => ({
        sequence: index + 1,
        percentage: "1",
        dueDate: JATUH_TEMPO,
      }),
    );

    const hasil = skema(kebanyakan);
    expect(hasil.valid).toBe(false);
    if (hasil.valid) return;
    expect(hasil.reason).toContain(String(MAX_TERMIN_ROWS));
  });

  it("Persentase nol atau di atas 100 pada satu baris ditolak", () => {
    expect(
      skema([
        { sequence: 1, percentage: "0", dueDate: JATUH_TEMPO },
        { sequence: 2, percentage: "100", dueDate: JATUH_TEMPO_DUA },
      ]).valid,
    ).toBe(false);
  });
});

describe("F13-AC2 Sistem menolak skema yang jumlah persentasenya bukan seratus, dan menolak termin pertama di luar rentang 25 sampai 50 persen.", () => {
  it("Uang muka 25 persen dan 50 persen masih di dalam batas IITBOOK", () => {
    const bawah = skema([
      { sequence: 1, percentage: "25", dueDate: JATUH_TEMPO },
      { sequence: 2, percentage: "75", dueDate: JATUH_TEMPO_DUA },
    ]);
    const atas = skema([
      { sequence: 1, percentage: "50", dueDate: JATUH_TEMPO },
      { sequence: 2, percentage: "50", dueDate: JATUH_TEMPO_DUA },
    ]);

    expect(bawah.valid).toBe(true);
    expect(atas.valid).toBe(true);
  });

  it("Uang muka 24.99 persen dan 50.01 persen ditolak", () => {
    const kurang = skema([
      { sequence: 1, percentage: "24.99", dueDate: JATUH_TEMPO },
      { sequence: 2, percentage: "75.01", dueDate: JATUH_TEMPO_DUA },
    ]);
    const lebih = skema([
      { sequence: 1, percentage: "50.01", dueDate: JATUH_TEMPO },
      { sequence: 2, percentage: "49.99", dueDate: JATUH_TEMPO_DUA },
    ]);

    expect(kurang.valid).toBe(false);
    expect(lebih.valid).toBe(false);
    if (kurang.valid) return;
    expect(kurang.reason).toMatch(/25|uang muka|IITBOOK/i);
  });

  it("Satu termin 100 persen ditolak karena uang mukanya di luar 25 sampai 50", () => {
    const hasil = skema([
      { sequence: 1, percentage: "100", dueDate: JATUH_TEMPO },
    ]);

    expect(hasil.valid).toBe(false);
  });
});
