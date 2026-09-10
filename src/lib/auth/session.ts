import { hasActiveAssignment } from "./period";
import type { RoleAssignment, UserStatus } from "./types";

export interface SessionRecord {
  expiresAt: Date;
  /** Terisi ketika pengguna logout atau sesinya dicabut pengurus. */
  revokedAt: Date | null;
}

export interface SessionUser {
  status: UserStatus;
  roleAssignments: RoleAssignment[];
}

/**
 * Kode mesin untuk alasan sesi berakhir. Dipakai UI supaya pesan di halaman
 * masuk bisa dibedakan tanpa menyalin kalimat panjang lewat query string.
 */
export type SessionEndCode =
  | "revoked"
  | "expired"
  | "inactive"
  | "no_assignment";

export type SessionEvaluation =
  | { valid: true }
  | { valid: false; reason: string; code: SessionEndCode };

export interface EvaluateSessionInput {
  session: SessionRecord;
  user: SessionUser;
  now: Date;
}

/**
 * Menentukan apakah sebuah sesi masih boleh dipakai.
 *
 * Status akun dan masa jabatan ikut diperiksa pada setiap permintaan, bukan
 * hanya saat masuk, sehingga sesi berakhir seketika begitu akun dinonaktifkan
 * atau masa jabatan habis (PRD bab 5, Keamanan Akses).
 */
export function evaluateSession(
  input: EvaluateSessionInput,
): SessionEvaluation {
  const { session, user, now } = input;

  if (
    session.revokedAt !== null &&
    now.getTime() >= session.revokedAt.getTime()
  ) {
    return {
      valid: false,
      code: "revoked",
      reason: "Sesi Anda sudah berakhir. Silakan masuk kembali.",
    };
  }

  if (now.getTime() >= session.expiresAt.getTime()) {
    return {
      valid: false,
      code: "expired",
      reason:
        "Sesi Anda sudah berakhir karena tidak dipakai terlalu lama. Silakan masuk kembali.",
    };
  }

  if (user.status !== "ACTIVE") {
    return {
      valid: false,
      code: "inactive",
      reason:
        "Akun Anda sudah dinonaktifkan, sehingga sesinya ikut berakhir. Hubungi pengurus TechDev yang memegang wewenang administrasi akun.",
    };
  }

  if (!hasActiveAssignment(user.roleAssignments, now)) {
    return {
      valid: false,
      code: "no_assignment",
      reason:
        "Masa jabatan Anda sudah berakhir, sehingga sesinya ikut berakhir. Minta pengurus TechDev memperbarui periode jabatan Anda bila ini keliru.",
    };
  }

  return { valid: true };
}
