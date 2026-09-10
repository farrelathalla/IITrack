/**
 * Membaca angka nilai project dari isian formulir.
 * Koma desimal diizinkan; string kosong berarti tidak diisi.
 */
export function parseOptionalProjectValue(
  raw: string,
): { ok: true; value: number | null } | { ok: false; message: string } {
  const trimmed = raw.trim();
  if (trimmed === "") return { ok: true, value: null };

  const parsed = Number(trimmed.replace(",", "."));
  if (!Number.isFinite(parsed)) {
    return { ok: false, message: "Nilai project harus berupa angka." };
  }

  return { ok: true, value: parsed };
}
