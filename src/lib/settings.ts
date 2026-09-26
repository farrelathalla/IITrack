/**
 * Sub-halaman Pengaturan sesuai jabatan (PRD bab 8.7).
 */

import { isCLevel } from "./auth/roles";
import type { RoleName } from "./auth/types";

export type SettingsSection =
  | "profile"
  | "users"
  | "permissions"
  | "workflow"
  | "access"
  | "system";

export const SETTINGS_SECTIONS: { id: SettingsSection; label: string }[] = [
  { id: "profile", label: "Profil" },
  { id: "users", label: "Users & Roles" },
  { id: "permissions", label: "Role Permissions" },
  { id: "workflow", label: "Workflow & Approver" },
  { id: "access", label: "Project Access" },
  { id: "system", label: "System" },
];

export function visibleSections(role: RoleName | null): SettingsSection[] {
  if (role === "SUPER_ADMIN") {
    return ["profile", "users", "permissions", "workflow", "access", "system"];
  }
  if (isCLevel(role))
    return ["profile", "users", "permissions", "workflow", "access"];
  return ["profile"];
}

export function isSettingsSection(value: string): value is SettingsSection {
  return SETTINGS_SECTIONS.some((section) => section.id === value);
}

// ─── Matriks izin untuk halaman Role Permissions ──────────────────────────

export const PERMISSION_AREAS = [
  "Project Management",
  "Tech Development",
  "Finance",
  "Project Assignment",
  "Role Management",
  "Workflow Config",
] as const;

export const PERMISSION_ACTIONS = [
  "View",
  "Create",
  "Edit",
  "Delete",
  "Approve",
  "Assign",
  "Manage Access",
] as const;

type Area = (typeof PERMISSION_AREAS)[number];
type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

/**
 * "full", "limited" (hanya project yang ditugaskan / divisinya), atau kosong.
 * Diturunkan dari matriks PRD bab 2.4; aturan sebenarnya ditegakkan di
 * src/lib/auth/access.ts, halaman ini hanya menampilkannya.
 */
export type Grant = "full" | "limited" | null;

const NONE: Record<PermissionAction, Grant> = {
  View: "full",
  Create: null,
  Edit: null,
  Delete: null,
  Approve: null,
  Assign: null,
  "Manage Access": null,
};

function row(
  overrides: Partial<Record<PermissionAction, Grant>>,
): Record<PermissionAction, Grant> {
  return { ...NONE, ...overrides };
}

type RolePermissions = Record<Area, Record<PermissionAction, Grant>>;

// Jabatan wakil sama dengan jabatan utamanya (PRD bab 2.1).
const OPS_LEAD: RolePermissions = {
  "Project Management": row({ Create: "full", Approve: "full" }),
  "Tech Development": row({}),
  Finance: row({}),
  "Project Assignment": row({ Assign: "full" }),
  "Role Management": row({ View: "limited" }),
  "Workflow Config": row({}),
};

const TECH_LEAD: RolePermissions = {
  "Project Management": row({}),
  "Tech Development": row({ Edit: "full", Approve: "full" }),
  Finance: row({}),
  "Project Assignment": row({ Assign: "full" }),
  "Role Management": row({ View: "limited" }),
  "Workflow Config": row({}),
};

const FINANCE_LEAD: RolePermissions = {
  "Project Management": row({}),
  "Tech Development": row({}),
  Finance: row({ Edit: "full", Approve: "full" }),
  "Project Assignment": row({ Assign: "full" }),
  "Role Management": row({ View: "limited" }),
  "Workflow Config": row({}),
};

export const ROLE_PERMISSIONS: Record<RoleName, RolePermissions> = {
  PROJECT_MANAGER: {
    "Project Management": row({ Edit: "limited" }),
    "Tech Development": row({}),
    Finance: row({ Edit: "limited" }),
    "Project Assignment": row({}),
    "Role Management": row({ View: null }),
    "Workflow Config": row({ View: null }),
  },
  COO: OPS_LEAD,
  VICE_COO: OPS_LEAD,
  CTO: TECH_LEAD,
  VICE_CTO: TECH_LEAD,
  TECH_DEVELOPER: {
    "Project Management": row({}),
    "Tech Development": row({ Edit: "limited" }),
    Finance: row({ View: "limited" }),
    "Project Assignment": row({}),
    "Role Management": row({ View: null }),
    "Workflow Config": row({ View: null }),
  },
  CFO: FINANCE_LEAD,
  VICE_CFO: FINANCE_LEAD,
  FINANCE_POC: {
    "Project Management": row({}),
    "Tech Development": row({}),
    Finance: row({ Edit: "limited", Approve: "limited" }),
    "Project Assignment": row({}),
    "Role Management": row({ View: null }),
    "Workflow Config": row({ View: null }),
  },
  SUPER_ADMIN: {
    "Project Management": row({ View: "limited" }),
    "Tech Development": row({ View: "limited" }),
    Finance: row({ View: "limited" }),
    "Project Assignment": row({}),
    "Role Management": row({
      Create: "full",
      Edit: "full",
      "Manage Access": "full",
    }),
    "Workflow Config": row({ Edit: "full" }),
  },
};
