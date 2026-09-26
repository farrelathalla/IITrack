import type { Division, ProjectRole, RoleName } from "./types";

/** Label jabatan persis seperti di prototipe dan PRD bab 2.1. */
export const ROLE_LABELS: Record<RoleName, string> = {
  SUPER_ADMIN: "Super Admin",
  COO: "COO",
  VICE_COO: "Vice COO",
  PROJECT_MANAGER: "Project Manager",
  CTO: "CTO",
  VICE_CTO: "Vice CTO",
  TECH_DEVELOPER: "Tech Developer",
  CFO: "CFO",
  VICE_CFO: "Vice CFO",
  FINANCE_POC: "Finance POC",
};

export const ROLE_DIVISION: Record<RoleName, Division> = {
  SUPER_ADMIN: "SYSTEM",
  COO: "OPERATIONAL",
  VICE_COO: "OPERATIONAL",
  PROJECT_MANAGER: "OPERATIONAL",
  CTO: "TECHDEV",
  VICE_CTO: "TECHDEV",
  TECH_DEVELOPER: "TECHDEV",
  CFO: "FINANCE",
  VICE_CFO: "FINANCE",
  FINANCE_POC: "FINANCE",
};

export const DIVISION_LABELS: Record<Division, string> = {
  SYSTEM: "Sistem",
  OPERATIONAL: "Operasional",
  TECHDEV: "Tech Development",
  FINANCE: "Finance",
};

/** Urutan tampil di daftar dan pilihan jabatan. */
export const ROLE_ORDER: RoleName[] = [
  "PROJECT_MANAGER",
  "COO",
  "VICE_COO",
  "CTO",
  "VICE_CTO",
  "TECH_DEVELOPER",
  "CFO",
  "VICE_CFO",
  "FINANCE_POC",
  "SUPER_ADMIN",
];

export const OPS_LEADS: readonly RoleName[] = ["COO", "VICE_COO"];
export const TECH_LEADS: readonly RoleName[] = ["CTO", "VICE_CTO"];
export const FINANCE_LEADS: readonly RoleName[] = ["CFO", "VICE_CFO"];

/** COO/VCOO, CTO/VCTO, CFO/VCFO. Melihat semua project (PRD bab 8.1). */
export const C_LEVEL: readonly RoleName[] = [
  ...OPS_LEADS,
  ...TECH_LEADS,
  ...FINANCE_LEADS,
];

export function isOpsLead(role: RoleName | null): boolean {
  return role !== null && OPS_LEADS.includes(role);
}

export function isTechLead(role: RoleName | null): boolean {
  return role !== null && TECH_LEADS.includes(role);
}

export function isFinanceLead(role: RoleName | null): boolean {
  return role !== null && FINANCE_LEADS.includes(role);
}

export function isCLevel(role: RoleName | null): boolean {
  return role !== null && C_LEVEL.includes(role);
}

/**
 * Jabatan yang boleh menerima penugasan project, sesuai divisi (PRD bab 2.2:
 * "Penugasan hanya bisa diberikan kepada akun aktif dari divisi yang sesuai").
 */
export const ASSIGNABLE_ROLES: Record<ProjectRole, readonly RoleName[]> = {
  PM: ["PROJECT_MANAGER"],
  DEVELOPER: ["TECH_DEVELOPER"],
  FINANCE_POC: ["FINANCE_POC"],
};

export const PROJECT_ROLE_LABELS: Record<ProjectRole, string> = {
  PM: "Project Manager",
  DEVELOPER: "Developer",
  FINANCE_POC: "Finance POC",
};

/** Divisi yang edit-aksesnya dibuka oleh peran di project. */
export const PROJECT_ROLE_DIVISION: Record<ProjectRole, Division> = {
  PM: "OPERATIONAL",
  DEVELOPER: "TECHDEV",
  FINANCE_POC: "FINANCE",
};

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter((part) => /^\p{L}/u.test(part))
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("")
    .slice(0, 2);
}
