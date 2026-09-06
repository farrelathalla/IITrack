/**
 * Pemeriksa skema termin (F13).
 *
 * Aturan IITBOOK dan PRD F13 diuji di sini tanpa basis data: jumlah persentase
 * tepat seratus, dan termin pertama (uang muka) 25 sampai 50 persen. Nominal
 * dihitung dari nilai project supaya F16 nanti bisa mengisi invoice dari baris
 * yang sudah tersimpan, bukan dari ketikan ulang.
 */

export const SCHEME_TOTAL_BASIS_POINTS = 10_000;
export const DP_MIN_BASIS_POINTS = 2_500;
export const DP_MAX_BASIS_POINTS = 5_000;

export interface TerminDraft {
  sequence: number;
  percentage?: string | number | null;
  amount?: string | number | null;
  dueDate: Date | string;
  label?: string | null;
}

export interface NormalizedTermin {
  sequence: number;
  /** Persentase dua desimal, misalnya "30.00". */
  percentage: string;
  /** Nominal dua desimal, misalnya "3000000.00". */
  amount: string;
  dueDate: Date;
}

export type SchemeValidation =
  | { valid: true; termins: NormalizedTermin[] }
  | { valid: false; reason: string };

function invalid(reason: string): SchemeValidation {
  return { valid: false, reason };
}

/**
 * Membaca angka desimal menjadi bilangan bulat berskala tetap.
 *
 * "30.5" dengan dua desimal menjadi 3050. Lebih dari dua desimal ditolak,
 * supaya 33.333 tidak lolos diam-diam lalu jumlahnya pecah saat dijumlahkan.
 */
export function parseScaledDecimal(
  raw: string | number,
  decimals: number,
): bigint | null {
  const text = String(raw).trim().replace(",", ".");
  if (text === "") return null;

  const pola = new RegExp(`^-?\\d+(\\.\\d{1,${decimals}})?$`);
  if (!pola.test(text)) return null;

  const negatif = text.startsWith("-");
  const [utuh, pecahan = ""] = text.replace("-", "").split(".");
  const skala = BigInt(10) ** BigInt(decimals);
  const nilai =
    BigInt(utuh || "0") * skala + BigInt(pecahan.padEnd(decimals, "0") || "0");
  return negatif ? -nilai : nilai;
}

export function formatScaledDecimal(nilai: bigint, decimals: number): string {
  const skala = BigInt(10) ** BigInt(decimals);
  const negatif = nilai < BigInt(0);
  const mutlak = negatif ? -nilai : nilai;
  const utuh = mutlak / skala;
  const pecahan = (mutlak % skala).toString().padStart(decimals, "0");
  return `${negatif ? "-" : ""}${utuh.toString()}.${pecahan}`;
}

function parseDueDate(value: Date | string): Date | null {
  const date =
    value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date;
}

function roundQuotient(numerator: bigint, denominator: bigint): bigint {
  if (denominator <= BigInt(0)) {
    throw new Error("Pembagi harus positif.");
  }
  const setengah = denominator / BigInt(2);
  return (numerator + setengah) / denominator;
}

/**
 * Menormalkan satu skema termin menjadi baris siap simpan.
 *
 * Pengaju boleh mengisi persentase, nominal, atau keduanya. Yang kosong diisi
 * dari nilai project. Yang keduanya diisi harus cocok, supaya angka di invoice
 * nanti tidak beda dengan yang terlihat di jadwal.
 */
export function validateTerminScheme(input: {
  projectValue: string | number | null | undefined;
  drafts: readonly TerminDraft[];
}): SchemeValidation {
  if (
    input.projectValue === null ||
    input.projectValue === undefined ||
    String(input.projectValue).trim() === ""
  ) {
    return invalid(
      "Nilai project belum diisi, jadi skema termin belum bisa dihitung maupun disimpan.",
    );
  }

  const nilaiProject = parseScaledDecimal(input.projectValue, 2);
  if (nilaiProject === null || nilaiProject <= BigInt(0)) {
    return invalid(
      "Nilai project harus lebih besar dari nol, jadi skema termin belum bisa dihitung.",
    );
  }

  if (input.drafts.length === 0) {
    return invalid(
      "Skema termin kosong tidak bisa disimpan. Isi paling tidak dua termin, karena uang muka harus 25 sampai 50 persen.",
    );
  }

  const terurut = [...input.drafts].sort((a, b) => a.sequence - b.sequence);
  const urutan = terurut.map((item) => item.sequence);

  if (urutan.some((n) => !Number.isInteger(n) || n < 1)) {
    return invalid(
      "Nomor termin harus bilangan bulat mulai dari 1, tanpa nol atau pecahan.",
    );
  }

  if (new Set(urutan).size !== urutan.length) {
    return invalid("Nomor termin tidak boleh berulang dalam satu skema.");
  }

  if (urutan[0] !== 1 || urutan.some((n, i) => n !== i + 1)) {
    return invalid(
      "Nomor termin harus berurutan mulai dari 1 tanpa lompatan, supaya urutan uang muka dan pelunasan tidak tertukar.",
    );
  }

  const termins: NormalizedTermin[] = [];
  let jumlahPoin = BigInt(0);

  for (const draft of terurut) {
    const dueDate = parseDueDate(draft.dueDate);
    if (!dueDate) {
      return invalid(
        "Setiap termin wajib punya tanggal jatuh tempo yang bisa dibaca.",
      );
    }

    const adaPersentase =
      draft.percentage !== null &&
      draft.percentage !== undefined &&
      String(draft.percentage).trim() !== "";
    const adaNominal =
      draft.amount !== null &&
      draft.amount !== undefined &&
      String(draft.amount).trim() !== "";

    if (!adaPersentase && !adaNominal) {
      return invalid(
        "Setiap termin wajib punya persentase atau nominal, supaya jadwalnya bisa dihitung.",
      );
    }

    let poin: bigint | null = adaPersentase
      ? parseScaledDecimal(draft.percentage as string | number, 2)
      : null;
    let sen: bigint | null = adaNominal
      ? parseScaledDecimal(draft.amount as string | number, 2)
      : null;

    if (adaPersentase && poin === null) {
      return invalid(
        "Persentase termin hanya boleh sampai dua angka di belakang koma, misalnya 30 atau 30.50.",
      );
    }
    if (adaNominal && sen === null) {
      return invalid(
        "Nominal termin hanya boleh sampai dua angka di belakang koma.",
      );
    }

    if (poin === null && sen !== null) {
      poin = roundQuotient(
        sen * BigInt(SCHEME_TOTAL_BASIS_POINTS),
        nilaiProject,
      );
    }
    if (sen === null && poin !== null) {
      sen = roundQuotient(
        nilaiProject * poin,
        BigInt(SCHEME_TOTAL_BASIS_POINTS),
      );
    }

    if (poin === null || sen === null) {
      return invalid("Persentase atau nominal termin tidak bisa dibaca.");
    }

    if (poin <= BigInt(0) || poin > BigInt(SCHEME_TOTAL_BASIS_POINTS)) {
      return invalid(
        "Persentase setiap termin harus lebih besar dari nol dan tidak boleh lebih dari 100.",
      );
    }
    if (sen <= BigInt(0)) {
      return invalid("Nominal setiap termin harus lebih besar dari nol.");
    }

    if (adaPersentase && adaNominal) {
      const senDariPersen = roundQuotient(
        nilaiProject * poin,
        BigInt(SCHEME_TOTAL_BASIS_POINTS),
      );
      if (senDariPersen !== sen) {
        return invalid(
          "Nominal termin tidak cocok dengan persentasenya pada nilai project ini.",
        );
      }
    }

    jumlahPoin += poin;
    termins.push({
      sequence: draft.sequence,
      percentage: formatScaledDecimal(poin, 2),
      amount: formatScaledDecimal(sen, 2),
      dueDate,
    });
  }

  const dp = parseScaledDecimal(termins[0].percentage, 2);
  if (
    dp === null ||
    dp < BigInt(DP_MIN_BASIS_POINTS) ||
    dp > BigInt(DP_MAX_BASIS_POINTS)
  ) {
    return invalid(
      "Termin pertama adalah uang muka, jadi persentasenya harus 25 sampai 50 persen sesuai IITBOOK.",
    );
  }

  if (jumlahPoin !== BigInt(SCHEME_TOTAL_BASIS_POINTS)) {
    return invalid(
      `Jumlah persentase seluruh termin harus tepat 100, bukan ${formatScaledDecimal(jumlahPoin, 2)}.`,
    );
  }

  const jumlahSen = termins.reduce(
    (akum, item) => akum + (parseScaledDecimal(item.amount, 2) ?? BigInt(0)),
    BigInt(0),
  );
  const selisih = nilaiProject - jumlahSen;
  if (selisih !== BigInt(0)) {
    const terakhir = termins[termins.length - 1];
    const senTerakhir =
      (parseScaledDecimal(terakhir.amount, 2) ?? BigInt(0)) + selisih;
    if (senTerakhir <= BigInt(0)) {
      return invalid(
        "Nominal termin tidak bisa disesuaikan supaya jumlahnya sama dengan nilai project.",
      );
    }
    terakhir.amount = formatScaledDecimal(senTerakhir, 2);
  }

  return { valid: true, termins };
}
