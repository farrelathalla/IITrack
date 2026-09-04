/**
 * Kontrak hak akses IITrack (F03).
 *
 * Berkas ini sengaja tidak mengimpor Prisma maupun modul Next.js. PRD bab 3.9
 * mewajibkan aturan izin diuji tanpa menjalankan basis data maupun peramban,
 * karena aturan ini dipanggil setiap request dan diuji puluhan kali per hari.
 */

export type Division = "OPERATIONAL" | "FINANCE" | "TECHDEV";

export type RoleName =
  | "COO"
  | "VICE_COO"
  | "CFO"
  | "VICE_CFO"
  | "CTO"
  | "VICE_CTO"
  | "PROJECT_MANAGER"
  | "FINANCE_POC"
  | "OFFICER_OPERATIONAL"
  | "TECHDEV_MEMBER";

export type UserStatus = "INVITED" | "ACTIVE" | "DEACTIVATED";

/**
 * Daftar aksi yang dikenal sistem. Seluruh fitur memanggil daftar ini; tidak ada
 * fitur yang memeriksa izin dengan caranya sendiri (Pembagian Kerja bab 5).
 */
export type Action =
  // Master data
  | "master_data.view"
  | "client.manage"
  | "member.manage"
  // Project
  | "project.view"
  | "project.view_value"
  | "project.create"
  | "project.edit_operational"
  | "project.assign_pm"
  | "project.override_id"
  | "project.assign_member"
  // Stage dan gate
  | "stage.view"
  | "stage.change"
  | "gate.override"
  // Finance
  | "finance.view"
  | "finance.edit"
  | "finance.submit"
  | "finance.approve_final"
  // TechDev
  | "techdev.view"
  | "techdev.edit"
  | "staffing.request"
  | "staffing.approve"
  // Approval lintas domain
  | "approval.project_value_scope"
  | "approval.p0_second_confirmation"
  // Administrasi akun (System Administrator privilege)
  | "user.invite"
  | "user.deactivate"
  | "user.manage_role_assignment"
  | "user.override_period"
  // Jejak aktivitas
  | "audit.view"
  | "audit.delete";

/**
 * Penetapan jabatan beserta masa berlakunya. Izin menempel pada penetapan ini,
 * bukan pada orangnya, sehingga akses berhenti sendiri saat kepengurusan
 * berganti (PRD bab 3.2, Member dan Role).
 */
export interface RoleAssignment {
  role: RoleName;
  division: Division;
  /** Awal masa jabatan, inklusif. */
  startDate: Date;
  /** Akhir masa jabatan, eksklusif. `null` berarti belum ditentukan. */
  endDate: Date | null;
  /**
   * System Administrator privilege. Bukan divisi keempat, melainkan wewenang
   * administratif yang menempel pada anggota TechDev yang ditunjuk C-Level
   * (PRD bab 3.5). Privilege ikut berakhir bersama masa jabatannya.
   */
  isSystemAdmin: boolean;
}

export interface Actor {
  userId: string;
  status: UserStatus;
  roleAssignments: RoleAssignment[];
}

/**
 * Konteks project yang sedang diakses. `assignedDivisions` berisi divisi tempat
 * actor terdaftar sebagai pelaksana pada project tersebut, kosong bila ia bukan
 * pelaksana.
 */
export interface ProjectContext {
  projectId: string;
  assignedDivisions: Division[];
}

export interface PermissionQuery {
  actor: Actor;
  action: Action;
  project?: ProjectContext;
  /** Waktu evaluasi. Wajib eksplisit supaya masa jabatan dapat diuji. */
  now: Date;
}

export type PermissionDecision =
  | { allowed: true }
  | { allowed: false; reason: string };
