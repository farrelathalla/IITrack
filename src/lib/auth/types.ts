/**
 * Tipe dasar akun dan jabatan IITrack (PRD bab 2).
 *
 * Berkas di `src/lib` sengaja tidak mengimpor Prisma maupun modul Next.js,
 * supaya aturan izin bisa diuji tanpa menjalankan basis data maupun peramban.
 */

export type RoleName =
  | "SUPER_ADMIN"
  | "COO"
  | "VICE_COO"
  | "PROJECT_MANAGER"
  | "CTO"
  | "VICE_CTO"
  | "TECH_DEVELOPER"
  | "CFO"
  | "VICE_CFO"
  | "FINANCE_POC";

export type Division = "SYSTEM" | "OPERATIONAL" | "TECHDEV" | "FINANCE";

export type UserStatus = "ACTIVE" | "INACTIVE";

/** Peran seseorang di dalam satu project (PRD bab 2.2). */
export type ProjectRole = "PM" | "DEVELOPER" | "FINANCE_POC";

/**
 * Jabatan pada satu periode. `endDate` adalah yang lebih dulu di antara akhir
 * periode dan waktu jabatan itu diakhiri lebih awal.
 */
export interface RoleAssignment {
  role: RoleName;
  /** Inklusif. */
  startDate: Date;
  /** Eksklusif. */
  endDate: Date;
}

/** Orang yang sedang melakukan permintaan. */
export interface Actor {
  userId: string;
  name: string;
  status: UserStatus;
  roleAssignments: RoleAssignment[];
}
