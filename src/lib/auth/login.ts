import { verifyPassword } from "./password";
import { hasActiveAssignment } from "./period";
import type { RoleAssignment, UserStatus } from "./types";

/**
 * Satu kalimat penolakan yang sama dipakai untuk email tidak terdaftar, akun
 * belum aktivasi, maupun kata sandi salah, supaya halaman masuk tidak bisa
 * dipakai menebak email siapa saja yang terdaftar.
 */
const GENERIC_REJECTION = "Email atau kata sandi yang Anda masukkan salah.";

/**
 * Hash pembanding untuk email yang tidak terdaftar. Tanpa ini, permintaan
 * dengan email tak dikenal selesai jauh lebih cepat daripada yang dikenal, dan
 * selisih waktunya sendiri sudah membocorkan informasi.
 */
const DUMMY_HASH =
  "scrypt$32768$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=";

export interface AuthenticatableUser {
  id: string;
  status: UserStatus;
  /** Kosong selama akun belum menyelesaikan aktivasi. */
  passwordHash: string | null;
  roleAssignments: RoleAssignment[];
}

export type AuthenticationResult =
  | { authenticated: true; userId: string }
  | { authenticated: false; reason: string };

export interface AuthenticateInput {
  /** Kosong berarti emailnya tidak terdaftar. */
  user: AuthenticatableUser | null;
  password: string;
  now: Date;
}

export async function authenticate(
  input: AuthenticateInput,
): Promise<AuthenticationResult> {
  const { user, password, now } = input;

  if (!user?.passwordHash) {
    await verifyPassword(password, DUMMY_HASH);
    return { authenticated: false, reason: GENERIC_REJECTION };
  }

  if (!(await verifyPassword(password, user.passwordHash))) {
    return { authenticated: false, reason: GENERIC_REJECTION };
  }

  // Sejak titik ini pemasuk terbukti memegang kredensial akun tersebut, jadi
  // alasan yang lebih spesifik tidak lagi membocorkan apa pun kepada orang lain.
  if (user.status === "DEACTIVATED") {
    return {
      authenticated: false,
      reason:
        "Akun Anda sudah dinonaktifkan. Hubungi pengurus TechDev yang memegang wewenang administrasi akun.",
    };
  }

  if (!hasActiveAssignment(user.roleAssignments, now)) {
    return {
      authenticated: false,
      reason:
        "Masa jabatan Anda sudah berakhir atau belum dimulai, sehingga akun ini belum bisa dipakai. Minta pengurus TechDev memperbarui periode jabatan Anda.",
    };
  }

  return { authenticated: true, userId: user.id };
}
