/**
 * Matriks hak akses IITrack (PRD bab 2.4).
 *
 * Akses = jabatan × penugasan. Jabatan menentukan domain kewenangan, penugasan
 * di project menentukan project mana yang boleh diubah. Fungsi ini dipanggil
 * server sebelum setiap perubahan; UI memakai fungsi yang sama hanya untuk
 * menyembunyikan tombol, bukan sebagai pengaman.
 */

import {
  DIVISION_LABELS,
  isCLevel,
  isFinanceLead,
  isOpsLead,
  isTechLead,
  ROLE_LABELS,
} from "./roles";
import type { Division, ProjectRole, RoleName } from "./types";

export interface Viewer {
  userId: string;
  /** Jabatan aktif; `null` bila akses sudah dicabut atau periodenya habis. */
  role: RoleName | null;
}

/** Jenis pengajuan di Pengaturan > Workflow & Approver. */
export type ApprovalKind =
  | "PROJECT_CHARTER"
  | "CHARTER_TECH"
  | "MOU"
  | "PROGRAMMER_CONTRACT"
  | "INVOICE"
  | "DISBURSEMENT";

/**
 * Approver yang dipilih di Pengaturan > Workflow & Approver. Bila ada, hanya
 * orang-orang ini yang boleh memutuskan; bila tidak ada, semua pemegang
 * jabatan approver boleh. Untuk INVOICE isinya cadangan Finance POC saja,
 * karena Finance POC project selalu boleh.
 */
export interface ApproverRule {
  userIds: readonly string[];
  /** "Rina (COO) atau Dimas (Vice COO)", untuk pesan penolakan dan label. */
  names: string;
}

export type ApproverRules = Partial<Record<ApprovalKind, ApproverRule>>;

/** Siapa saja yang ditugaskan di project, untuk keputusan izin. */
export interface ProjectAccess {
  closed: boolean;
  pmUserId: string | null;
  developerUserIds: readonly string[];
  financePocUserId: string | null;
  mouSigned: boolean;
  approvers?: ApproverRules;
}

export type ProjectAction =
  | "project.assignPm"
  | "project.edit"
  | "project.delete"
  | "project.close"
  | "stage1.edit"
  | "charter.edit"
  | "charter.decide"
  | "charter.decideTech"
  | "mou.edit"
  | "mou.decide"
  | "terms.edit"
  | "staffing.submit"
  | "developer.assign"
  | "contract.edit"
  | "contract.decide"
  | "tech.edit"
  | "financePoc.assign"
  | "term.pm"
  | "term.finance"
  | "ops.edit"
  | "disbursement.submit"
  | "disbursement.finance"
  | "disbursement.decide";

export type GlobalAction =
  | "project.create"
  | "users.view"
  | "users.manage"
  | "settings.view"
  | "settings.manage"
  | "projectAccess.view";

export type Decision = { allowed: true } | { allowed: false; reason: string };

const ALLOW: Decision = { allowed: true };

function deny(reason: string): Decision {
  return { allowed: false, reason };
}

export function isPm(viewer: Viewer, project: ProjectAccess): boolean {
  return project.pmUserId === viewer.userId;
}

export function isAssignedDeveloper(
  viewer: Viewer,
  project: ProjectAccess,
): boolean {
  return project.developerUserIds.includes(viewer.userId);
}

export function isFinancePoc(viewer: Viewer, project: ProjectAccess): boolean {
  return project.financePocUserId === viewer.userId;
}

const ONLY_PM =
  "Hanya PM yang ditugaskan di project ini yang bisa melakukannya.";

/** Menyempitkan izin approver ke orang yang dipilih di Workflow & Approver. */
function approverGate(
  viewer: Viewer,
  project: ProjectAccess,
  kind: ApprovalKind,
  base: Decision,
): Decision {
  const rule = project.approvers?.[kind];
  if (!base.allowed || !rule || rule.userIds.length === 0) return base;
  return rule.userIds.includes(viewer.userId)
    ? ALLOW
    : deny(
        `Pengajuan ini diputuskan oleh ${rule.names}, sesuai Pengaturan > Workflow & Approver.`,
      );
}

/** Finance POC project, atau CFO/VCFO sebagai cadangan (bisa dipersempit). */
function isFinanceActor(viewer: Viewer, project: ProjectAccess): boolean {
  if (isFinancePoc(viewer, project)) return true;
  if (!isFinanceLead(viewer.role)) return false;
  const rule = project.approvers?.INVOICE;
  return !rule || rule.userIds.length === 0
    ? true
    : rule.userIds.includes(viewer.userId);
}

/**
 * Menentukan boleh tidaknya aksi pada satu project. Pesan penolakan menyebut
 * alasan dan siapa yang berwenang (PRD bab 1.1).
 */
export function canOnProject(
  viewer: Viewer,
  action: ProjectAction,
  project: ProjectAccess,
): Decision {
  const role = viewer.role;
  if (role === null) {
    return deny("Akses IITrack Anda sudah tidak aktif.");
  }
  if (role === "SUPER_ADMIN") {
    return deny(
      "Super Admin hanya bisa melihat project, tidak mengubah data, menugaskan orang, atau menyetujui pengajuan.",
    );
  }
  if (project.closed) {
    return deny("Project sudah ditutup dan bersifat read-only.");
  }

  const pm = isPm(viewer, project);
  const finance = isFinanceActor(viewer, project);

  switch (action) {
    case "project.assignPm":
      return isOpsLead(role)
        ? ALLOW
        : deny("Hanya COO atau Vice COO yang bisa mengganti PM.");

    case "project.edit":
      return pm || isOpsLead(role)
        ? ALLOW
        : deny(
            "Hanya PM project atau COO/Vice COO yang bisa mengubah detail project.",
          );

    case "project.delete":
      return isOpsLead(role)
        ? ALLOW
        : deny("Hanya COO atau Vice COO yang bisa menghapus project.");

    case "project.close":
      return pm || isOpsLead(role)
        ? ALLOW
        : deny("Hanya PM project atau COO/Vice COO yang bisa menutup project.");

    case "stage1.edit":
    case "charter.edit":
    case "mou.edit":
    case "staffing.submit":
    case "contract.edit":
    case "term.pm":
    case "ops.edit":
    case "disbursement.submit":
      return pm ? ALLOW : deny(ONLY_PM);

    case "charter.decide":
    case "mou.decide":
      return approverGate(
        viewer,
        project,
        action === "charter.decide" ? "PROJECT_CHARTER" : "MOU",
        isOpsLead(role)
          ? ALLOW
          : deny("Hanya COO atau Vice COO yang bisa memutuskan pengajuan ini."),
      );

    case "charter.decideTech":
      return approverGate(
        viewer,
        project,
        "CHARTER_TECH",
        isTechLead(role)
          ? ALLOW
          : deny(
              "Persetujuan sisi Tech untuk Project Charter hanya bisa diberikan CTO atau Vice CTO.",
            ),
      );

    case "terms.edit":
      if (project.mouSigned) {
        return isFinanceLead(role)
          ? ALLOW
          : deny(
              "MoU sudah ditandatangani. Setelah itu termin hanya bisa diubah CFO atau Vice CFO.",
            );
      }
      return pm ? ALLOW : deny(ONLY_PM);

    case "developer.assign":
      return isTechLead(role)
        ? ALLOW
        : deny("Hanya CTO atau Vice CTO yang bisa menugaskan developer.");

    case "contract.decide":
      return approverGate(
        viewer,
        project,
        "PROGRAMMER_CONTRACT",
        isTechLead(role)
          ? ALLOW
          : deny(
              "Hanya CTO atau Vice CTO yang bisa memutuskan Kontrak Programmer.",
            ),
      );

    // PM ikut boleh: laporan tech mengalir lewat PM (jawaban CTO, 29 Sep).
    case "tech.edit":
      return pm || isTechLead(role) || isAssignedDeveloper(viewer, project)
        ? ALLOW
        : deny(
            "Hanya PM atau developer yang ditugaskan di project ini, CTO, atau Vice CTO yang bisa mengubah data teknis.",
          );

    case "financePoc.assign":
      return isFinanceLead(role)
        ? ALLOW
        : deny("Hanya CFO atau Vice CFO yang bisa menunjuk Finance POC.");

    case "term.finance":
    case "disbursement.finance":
      if (finance) return ALLOW;
      return deny(
        isFinanceLead(role) && project.approvers?.INVOICE
          ? `Cadangan Finance POC untuk pengajuan ini adalah ${project.approvers.INVOICE.names}, sesuai Pengaturan > Workflow & Approver.`
          : "Hanya Finance POC project ini, atau CFO/Vice CFO sebagai cadangan, yang bisa memperbarui status ini.",
      );

    case "disbursement.decide":
      return approverGate(
        viewer,
        project,
        "DISBURSEMENT",
        isFinanceLead(role)
          ? ALLOW
          : deny(
              "Hanya CFO atau Vice CFO yang bisa memutuskan Finance Disbursement.",
            ),
      );
  }
}

export function canGlobally(viewer: Viewer, action: GlobalAction): Decision {
  const role = viewer.role;
  if (role === null) return deny("Akses IITrack Anda sudah tidak aktif.");

  switch (action) {
    case "project.create":
      return isOpsLead(role)
        ? ALLOW
        : deny("Hanya COO dan Vice COO yang dapat membuat project.");
    case "users.view":
    case "settings.view":
      return role === "SUPER_ADMIN" || isCLevel(role)
        ? ALLOW
        : deny("Halaman ini hanya untuk Super Admin dan C-Level.");
    case "projectAccess.view":
      return role === "SUPER_ADMIN" || isCLevel(role)
        ? ALLOW
        : deny("Halaman ini hanya untuk Super Admin dan C-Level.");
    case "users.manage":
    case "settings.manage":
      return role === "SUPER_ADMIN"
        ? ALLOW
        : deny("Hanya Super Admin yang bisa mengubah akun dan pengaturan.");
  }
}

/**
 * Siapa yang boleh mengatur approver per jenis pengajuan: Super Admin semua
 * jenis, C-Level hanya jenis pengajuan divisinya.
 */
export function canManageApprover(
  role: RoleName | null,
  kind: ApprovalKind,
): boolean {
  if (role === "SUPER_ADMIN") return true;
  switch (kind) {
    case "PROJECT_CHARTER":
    case "MOU":
      return isOpsLead(role);
    case "CHARTER_TECH":
    case "PROGRAMMER_CONTRACT":
      return isTechLead(role);
    case "INVOICE":
    case "DISBURSEMENT":
      return isFinanceLead(role);
  }
}

// ─── Visibilitas ───────────────────────────────────────────────────────────

/**
 * Nominal keuangan dan tautan MoU hanya terlihat oleh PM project, C-Level, dan
 * Finance POC project itu (PRD bab 2.4, aturan visibilitas).
 */
export function canSeeAmounts(viewer: Viewer, project: ProjectAccess): boolean {
  if (viewer.role === null) return false;
  return (
    isCLevel(viewer.role) ||
    isPm(viewer, project) ||
    isFinancePoc(viewer, project)
  );
}

export const canSeeMouLink = canSeeAmounts;

/**
 * Tautan Kontrak Programmer hanya terlihat oleh PM project, developer yang
 * bersangkutan, CTO/VCTO, dan CFO/VCFO.
 */
export function canSeeContractLink(
  viewer: Viewer,
  project: ProjectAccess,
  developerId: string,
): boolean {
  if (viewer.role === null) return false;
  return (
    isPm(viewer, project) ||
    viewer.userId === developerId ||
    isTechLead(viewer.role) ||
    isFinanceLead(viewer.role)
  );
}

export type DivisionTab = "pm" | "tech" | "finance";

export const TAB_DIVISION: Record<DivisionTab, Division> = {
  pm: "OPERATIONAL",
  tech: "TECHDEV",
  finance: "FINANCE",
};

/** Punya hak edit di tab divisi ini? Dipakai untuk banner read-only. */
export function canEditTab(
  viewer: Viewer,
  project: ProjectAccess,
  tab: DivisionTab,
): boolean {
  if (viewer.role === null || viewer.role === "SUPER_ADMIN" || project.closed) {
    return false;
  }
  switch (tab) {
    case "pm":
      return isPm(viewer, project);
    case "tech":
      return (
        isPm(viewer, project) ||
        isTechLead(viewer.role) ||
        isAssignedDeveloper(viewer, project)
      );
    case "finance":
      return isFinanceLead(viewer.role) || isFinancePoc(viewer, project);
  }
}

/** "Tampilan hanya baca, kamu tidak memiliki akses edit pada divisi X." */
export function readOnlyBanner(closed: boolean, tab: DivisionTab): string {
  if (closed) {
    return "Hanya baca. Project ini sudah ditutup.";
  }
  const name =
    tab === "pm" ? "Project Management" : DIVISION_LABELS[TAB_DIVISION[tab]];
  return `Hanya baca. Kamu tidak punya akses edit di divisi ${name}.`;
}

export type MyProjectRole = ProjectRole | "C_LEVEL";

export const MY_ROLE_LABELS: Record<MyProjectRole, string> = {
  PM: "Project Manager",
  DEVELOPER: "Developer",
  FINANCE_POC: "Finance POC",
  C_LEVEL: "C-Level",
};

/** Isi kolom "Peranku" di daftar project (PRD bab 8.2). */
export function myProjectRole(
  viewer: Viewer,
  project: ProjectAccess,
): MyProjectRole | null {
  if (isPm(viewer, project)) return "PM";
  if (isAssignedDeveloper(viewer, project)) return "DEVELOPER";
  if (isFinancePoc(viewer, project)) return "FINANCE_POC";
  if (isCLevel(viewer.role)) return "C_LEVEL";
  return null;
}

/**
 * C-Level melihat semua project; jabatan lain hanya yang ditugaskan (PRD bab
 * 8.1-8.2). Super Admin ikut melihat semua karena perannya memantau secara
 * read-only dan ia tidak pernah ditugaskan ke project mana pun.
 */
export function seesAllProjects(role: RoleName | null): boolean {
  return isCLevel(role) || role === "SUPER_ADMIN";
}

export function roleLabel(role: RoleName | null): string {
  return role ? ROLE_LABELS[role] : "Tidak aktif";
}
