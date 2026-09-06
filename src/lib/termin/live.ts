/**
 * Umpan balik langsung skema termin (F13-T02).
 *
 * Dihitung tanpa jatuh tempo, supaya panel hub bisa menandai jumlah % dan
 * rentang DP sebelum tombol simpan ditekan. Penolakan sungguhan tetap di
 * `validateTerminScheme` / `saveTerminScheme`.
 */

import {
  DP_MAX_BASIS_POINTS,
  DP_MIN_BASIS_POINTS,
  formatScaledDecimal,
  parseScaledDecimal,
  SCHEME_TOTAL_BASIS_POINTS,
} from "@/lib/termin/scheme";

export type LiveTerminDraft = {
  percentage?: string | number | null;
  amount?: string | number | null;
};

export type LiveCheckState = {
  ok: boolean;
  display: string;
};

export type LiveTerminFeedback = {
  total: LiveCheckState;
  dp: LiveCheckState;
};

function filled(value: string | number | null | undefined): boolean {
  return value !== null && value !== undefined && String(value).trim() !== "";
}

function projectValuePoints(
  projectValue: string | number | null | undefined,
): bigint | null {
  if (!filled(projectValue)) return null;
  const nilai = parseScaledDecimal(projectValue as string | number, 2);
  if (nilai === null || nilai <= BigInt(0)) return null;
  return nilai;
}

/**
 * Persentase satu baris dalam basis 0.01%. Diisi dari % bila ada, atau dari
 * nominal ÷ nilai project.
 */
export function liveRowBasisPoints(
  draft: LiveTerminDraft,
  projectValue: string | number | null | undefined,
): bigint | null {
  if (filled(draft.percentage)) {
    return parseScaledDecimal(draft.percentage as string | number, 2);
  }
  if (!filled(draft.amount)) return null;
  const nilai = projectValuePoints(projectValue);
  const sen = parseScaledDecimal(draft.amount as string | number, 2);
  if (nilai === null || sen === null) return null;
  return (sen * BigInt(SCHEME_TOTAL_BASIS_POINTS) + nilai / BigInt(2)) / nilai;
}

export function liveTerminFeedback(input: {
  projectValue: string | number | null | undefined;
  drafts: readonly LiveTerminDraft[];
}): LiveTerminFeedback {
  const points = input.drafts.map((draft) =>
    liveRowBasisPoints(draft, input.projectValue),
  );
  const known = points.filter((item): item is bigint => item !== null);
  const total = known.reduce((akum, item) => akum + item, BigInt(0));
  const dp = points[0] ?? null;

  return {
    total: {
      ok:
        known.length === input.drafts.length &&
        input.drafts.length > 0 &&
        total === BigInt(SCHEME_TOTAL_BASIS_POINTS),
      display: `${formatScaledDecimal(total, 2)} / 100`,
    },
    dp: {
      ok:
        dp !== null &&
        dp >= BigInt(DP_MIN_BASIS_POINTS) &&
        dp <= BigInt(DP_MAX_BASIS_POINTS),
      display: dp === null ? "—" : `${formatScaledDecimal(dp, 2)}%`,
    },
  };
}

export function toDateInputValue(value: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}
