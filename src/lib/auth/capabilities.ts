import type { Action, RoleName } from "./types";

/**
 * Kewenangan per jabatan, menyalin Tabel 1 PRD bab 3.5.
 *
 * `global` berlaku pada project mana pun tanpa perlu penugasan. `assigned`
 * hanya berlaku pada project tempat actor terdaftar sebagai pelaksana di
 * divisinya, sesuai aturan "hak edit sama dengan project assignment ditambah
 * division domain" (PRD bab 3.2).
 */
export interface RoleCapability {
  global: readonly Action[];
  assigned: readonly Action[];
}

/** Aksi yang boleh dilakukan siapa pun yang jabatannya masih aktif. */
const BASELINE_VIEW: readonly Action[] = [
  "project.view",
  "master_data.view",
  "stage.view",
  "audit.view",
];

export const ROLE_CAPABILITIES: Record<RoleName, RoleCapability> = {
  // Master data penuh, stage dan gate penuh, Finance dan TechDev lihat saja,
  // approval atas nilai dan scope project.
  COO: {
    global: [
      ...BASELINE_VIEW,
      "project.view_value",
      "project.create",
      "project.edit_operational",
      "project.assign_pm",
      "project.assign_member",
      "project.override_id",
      "client.manage",
      "member.manage",
      "stage.change",
      "gate.override",
      "finance.view",
      "techdev.view",
      "approval.project_value_scope",
    ],
    assigned: [],
  },

  // Finance penuh, approval invoice, kuitansi, pencairan, dan Priority Zero.
  CFO: {
    global: [
      ...BASELINE_VIEW,
      "project.view_value",
      "finance.view",
      "finance.edit",
      "finance.approve_final",
      "techdev.view",
      // Tiap C-Level menugaskan pelaksana di domainnya sendiri (F31-AC1).
      // Batas domainnya ditegakkan canAssignToDivision, bukan di sini.
      "project.assign_member",
    ],
    assigned: [],
  },

  // TechDev penuh, approval staffing request.
  CTO: {
    global: [
      ...BASELINE_VIEW,
      "project.view_value",
      "finance.view",
      "techdev.view",
      "techdev.edit",
      "staffing.approve",
      "project.assign_member",
    ],
    assigned: [],
  },

  // Master data dan stage sesuai penugasan, mengajukan ke Finance dan TechDev,
  // konfirmasi kedua pada Priority Zero.
  PROJECT_MANAGER: {
    global: [
      ...BASELINE_VIEW,
      // PM yang mendaftarkan project dan menerima Project ID-nya
      // (PRD bab 3.3). Menetapkan nomor secara manual tetap tidak boleh.
      "project.create",
      "finance.view",
      "techdev.view",
      "approval.p0_second_confirmation",
    ],
    assigned: [
      "project.view_value",
      "project.edit_operational",
      "stage.change",
      "gate.override",
      "finance.submit",
      "staffing.request",
    ],
  },

  // Finance sesuai penugasan, tanpa wewenang approval.
  FINANCE_POC: {
    global: [...BASELINE_VIEW, "finance.view"],
    assigned: ["project.view_value", "finance.edit"],
  },

  // Operational sesuai penugasan, Finance lihat saja, TechDev tidak ada.
  OFFICER_OPERATIONAL: {
    global: [
      ...BASELINE_VIEW,
      "finance.view",
      // Client adalah master data lintas project, bukan data per project, jadi
      // pengelolaannya tidak bisa dibatasi penugasan (F06). Tabel 1 menulis
      // "sesuai penugasan" untuk kolom master data; baris ini masih menunggu
      // konfirmasi tertulis stakeholder sesuai PRD bab 3.5.
      "client.manage",
    ],
    assigned: ["project.edit_operational", "stage.change"],
  },

  // Anggota TechDev yang mengerjakan kode tidak memakai IITrack (PRD bab 2.1).
  // Jabatan ini hanya menjadi tempat menempelnya System Administrator privilege.
  TECHDEV_MEMBER: {
    global: ["project.view"],
    assigned: [],
  },

  // Wakil memegang kewenangan yang sama dengan pejabat utamanya.
  VICE_COO: { global: [], assigned: [] },
  VICE_CFO: { global: [], assigned: [] },
  VICE_CTO: { global: [], assigned: [] },
};

ROLE_CAPABILITIES.VICE_COO = ROLE_CAPABILITIES.COO;
ROLE_CAPABILITIES.VICE_CFO = ROLE_CAPABILITIES.CFO;
ROLE_CAPABILITIES.VICE_CTO = ROLE_CAPABILITIES.CTO;

/**
 * Wewenang administratif yang menempel pada System Administrator privilege.
 * Sengaja hanya berisi administrasi akun dan jabatan: pemegangnya tidak boleh
 * menyetujui pengajuan bisnis, mengubah nilai project maupun data Finance, dan
 * tidak boleh menghapus audit log (PRD bab 3.5).
 */
export const SYSTEM_ADMIN_CAPABILITIES: readonly Action[] = [
  "user.invite",
  "user.deactivate",
  "user.manage_role_assignment",
  "user.override_period",
  "member.manage",
];

/**
 * Aksi yang tidak pernah diberikan kepada jabatan mana pun. Entri audit log
 * hanya bisa ditambah (PRD bab 5, Ketertelusuran).
 */
export const FORBIDDEN_ACTIONS: readonly Action[] = ["audit.delete"];
