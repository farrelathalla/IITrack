import type {
  Actor,
  Division,
  ProjectContext,
  RoleAssignment,
  RoleName,
  UserStatus,
} from "@/lib/auth/types";

/** Periode kepengurusan 2026/2027 yang dipakai sebagai baseline seluruh test. */
export const PERIOD_START = new Date("2026-08-01T00:00:00.000Z");
export const PERIOD_END = new Date("2027-08-01T00:00:00.000Z");

/** Titik waktu di tengah periode aktif. */
export const NOW = new Date("2026-09-04T03:00:00.000Z");

const DEFAULT_DIVISION: Record<RoleName, Division> = {
  COO: "OPERATIONAL",
  VICE_COO: "OPERATIONAL",
  PROJECT_MANAGER: "OPERATIONAL",
  OFFICER_OPERATIONAL: "OPERATIONAL",
  CFO: "FINANCE",
  VICE_CFO: "FINANCE",
  FINANCE_POC: "FINANCE",
  CTO: "TECHDEV",
  VICE_CTO: "TECHDEV",
  TECHDEV_MEMBER: "TECHDEV",
};

export function assignment(
  role: RoleName,
  overrides: Partial<RoleAssignment> = {},
): RoleAssignment {
  return {
    role,
    division: DEFAULT_DIVISION[role],
    startDate: PERIOD_START,
    endDate: PERIOD_END,
    isSystemAdmin: false,
    ...overrides,
  };
}

export function actor(
  role: RoleName | RoleName[],
  overrides: Partial<Actor> = {},
): Actor {
  const roles = Array.isArray(role) ? role : [role];
  return {
    userId: `user-${roles.join("-").toLowerCase()}`,
    status: "ACTIVE" satisfies UserStatus,
    roleAssignments: roles.map((r) => assignment(r)),
    ...overrides,
  };
}

/** Project tempat actor terdaftar sebagai pelaksana pada divisi tertentu. */
export function assignedProject(...divisions: Division[]): ProjectContext {
  return { projectId: "IIT-2627-001", assignedDivisions: divisions };
}

/** Project yang sama, tetapi actor bukan pelaksananya. */
export function foreignProject(): ProjectContext {
  return { projectId: "IIT-2627-001", assignedDivisions: [] };
}
