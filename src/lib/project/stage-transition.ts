import type { StageDefinition } from "./stages";
import { findStage, isKnownStage } from "./stages";

export type StageTransitionDecision =
  | { allowed: true }
  | { allowed: false; reason: string };

export interface EvaluateStageTransitionInput {
  catalogue: readonly StageDefinition[];
  /** Tahap berjalan, kosong bila project belum pernah dipindahkan. */
  from: string | null;
  to: string;
}

/**
 * Menilai apakah sebuah perpindahan tahap masuk akal secara struktur.
 *
 * Yang diperiksa hanya bentuknya: tahap tujuan dikenal, dan berbeda dari tahap
 * berjalan. Penegakan prasyarat, misalnya kontrak harus lengkap atau DP harus
 * lunas, adalah tugas Gate Engine F10 dan sengaja tidak dicampur ke sini supaya
 * kedua aturan bisa berubah sendiri-sendiri.
 */
export function evaluateStageTransition(
  input: EvaluateStageTransitionInput,
): StageTransitionDecision {
  const { catalogue, from, to } = input;

  if (catalogue.length === 0) {
    return {
      allowed: false,
      reason:
        "Daftar tahap project belum tersedia, jadi tahap belum bisa dipindahkan. Daftar resminya masih ditunggu dari COO.",
    };
  }

  if (!isKnownStage(catalogue, to)) {
    return {
      allowed: false,
      reason: `Tahap tujuan tidak dikenali sistem, jadi perpindahan tidak bisa dilanjutkan. Pilih salah satu tahap yang tersedia.`,
    };
  }

  if (from !== null && from === to) {
    const label = findStage(catalogue, to)?.label ?? to;
    return {
      allowed: false,
      reason: `Project ini sudah berada di tahap ${label}, jadi tidak ada yang perlu dipindahkan.`,
    };
  }

  return { allowed: true };
}
