import type { SessionEndCode } from "./session";

/**
 * Kode query `?alasan=` pada halaman masuk. Sengaja pendek dan stabil supaya
 * URL tetap bisa dibaca manusia tanpa membocorkan detail teknis.
 */
export type LoginAlasan = "logout" | "sesi" | "jabatan" | "akun";

/** Pesan yang menjelaskan kenapa pengguna kembali ke halaman masuk. */
export const LOGIN_NOTICES: Record<LoginAlasan, string> = {
  logout: "Anda sudah keluar dari IITrack.",
  sesi: "Sesi Anda sudah berakhir. Silakan masuk kembali.",
  jabatan:
    "Masa jabatan Anda sudah berakhir, sehingga sesinya ikut berakhir. Minta pengurus TechDev memperbarui periode jabatan Anda bila ini keliru.",
  akun: "Akun Anda sudah dinonaktifkan, sehingga sesinya ikut berakhir. Hubungi pengurus TechDev yang memegang wewenang administrasi akun.",
};

const KNOWN = new Set<string>(Object.keys(LOGIN_NOTICES));

export function isLoginAlasan(value: string | undefined): value is LoginAlasan {
  return value !== undefined && KNOWN.has(value);
}

/** Mengambil teks pemberitahuan untuk kode `alasan` yang dikenal. */
export function noticeForAlasan(
  alasan: string | undefined,
): string | undefined {
  if (!isLoginAlasan(alasan)) return undefined;
  return LOGIN_NOTICES[alasan];
}

/**
 * Memetakan kode mesin dari `evaluateSession` ke kode query halaman masuk.
 * Pencabutan dan kedaluwarsa idle sama-sama ditampilkan sebagai "sesi".
 */
export function alasanFromSessionEnd(
  code: SessionEndCode,
): Exclude<LoginAlasan, "logout"> {
  switch (code) {
    case "revoked":
    case "expired":
      return "sesi";
    case "inactive":
      return "akun";
    case "no_assignment":
      return "jabatan";
  }
}
