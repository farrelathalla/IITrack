import type { ProjectAccess, Viewer } from "@/lib/auth/access";
import type { Actor, RoleAssignment, RoleName } from "@/lib/auth/types";
import type { TermStep } from "@/lib/finance/terms";
import type { DocumentKind } from "@/lib/project/catalog";
import type {
  AssignmentSnapshot,
  DocumentSnapshot,
  ProjectSnapshot,
  SubmissionKind,
  SubmissionSnapshot,
  TermSnapshot,
} from "@/lib/project/snapshot";

/** Periode kepengurusan 2026/2027 yang dipakai sebagai baseline test. */
export const PERIOD_START = new Date("2026-08-01T00:00:00+07:00");
export const PERIOD_END = new Date("2027-08-01T00:00:00+07:00");

/** 22 Sep 2026, 10:00 WIB, tanggal "hari ini" di prototipe. */
export const NOW = new Date("2026-09-22T10:00:00+07:00");

export function day(iso: string): Date {
  return new Date(`${iso}T00:00:00+07:00`);
}

export function assignment(
  role: RoleName,
  overrides: Partial<RoleAssignment> = {},
): RoleAssignment {
  return {
    role,
    startDate: PERIOD_START,
    endDate: PERIOD_END,
    ...overrides,
  };
}

export function actor(role: RoleName, overrides: Partial<Actor> = {}): Actor {
  return {
    userId: `user-${role.toLowerCase()}`,
    name: role,
    status: "ACTIVE",
    roleAssignments: [assignment(role)],
    ...overrides,
  };
}

export function viewer(role: RoleName | null, userId = "someone"): Viewer {
  return { userId, role };
}

export const PM_ID = "pm-karen";
export const DEV_ID = "dev-anice";
export const DEV2_ID = "dev-rafi";
export const FIN_ID = "fin-evan";

export function access(overrides: Partial<ProjectAccess> = {}): ProjectAccess {
  return {
    closed: false,
    pmUserId: PM_ID,
    developerUserIds: [DEV_ID],
    financePocUserId: FIN_ID,
    mouSigned: false,
    ...overrides,
  };
}

// ─── Potret project ────────────────────────────────────────────────────────

export function member(
  role: AssignmentSnapshot["role"],
  userId: string,
  overrides: Partial<AssignmentSnapshot> = {},
): AssignmentSnapshot {
  return {
    userId,
    name: userId,
    role,
    techRole: role === "DEVELOPER" ? "Full-stack Developer" : null,
    userActive: true,
    startedAt: day("2026-08-01"),
    ...overrides,
  };
}

export function doc(
  kind: DocumentKind,
  overrides: Partial<DocumentSnapshot> = {},
): DocumentSnapshot {
  return {
    id: `doc-${kind}-${overrides.developerId ?? ""}`,
    kind,
    developerId: "",
    url: "https://docs.google.com/document/d/x",
    status: "DONE",
    deadline: null,
    signedAt: null,
    ownerId: PM_ID,
    ownerName: "Karen",
    updatedAt: day("2026-09-01"),
    ...overrides,
  };
}

export function submission(
  kind: SubmissionKind,
  document: DocumentSnapshot,
  status: SubmissionSnapshot["status"],
  overrides: Partial<SubmissionSnapshot> = {},
): SubmissionSnapshot {
  return {
    id: `sub-${document.id}-${status}-${overrides.submittedAt?.getTime() ?? 0}`,
    kind,
    documentId: document.id,
    status,
    submittedById: PM_ID,
    submittedByName: "Karen",
    submittedAt: day("2026-09-01"),
    decidedById: status === "PENDING" ? null : "coo",
    decidedByName: status === "PENDING" ? null : "Ghazy",
    decidedAt: status === "PENDING" ? null : day("2026-09-02"),
    feedback: status === "REJECTED" ? "Scope belum sesuai." : null,
    ...overrides,
  };
}

export function term(
  sequence: number,
  step: TermStep = "NOT_STARTED",
  overrides: Partial<TermSnapshot> = {},
): TermSnapshot {
  return {
    id: `term-${sequence}`,
    sequence,
    name: sequence === 1 ? "Termin 1 (DP)" : `Termin ${sequence}`,
    percentage: 30,
    amount: 4_500_000,
    dueDate: null,
    dueNote: null,
    step,
    feedback: null,
    invoiceRequestUrl: null,
    approvedInvoiceUrl: null,
    transferProofUrl: null,
    receiptUrl: null,
    completedAt: step === "DONE" ? day("2026-09-10") : null,
    updatedAt: day("2026-09-10"),
    ...overrides,
  };
}

export function emptyProject(
  overrides: Partial<ProjectSnapshot> = {},
): ProjectSnapshot {
  return {
    id: "p1",
    code: "IIT-2627-014",
    name: "Pharmanova Internal Platform",
    client: "PT Pharmanova Nusantara",
    type: "DEVELOPMENT",
    source: "BUSINESS_DEVELOPMENT",
    targetStart: day("2026-08-01"),
    targetEnd: day("2026-11-30"),
    internalNote: null,
    createdAt: day("2026-08-01"),
    closedAt: null,
    finalStatus: null,
    stage1DoneAt: null,
    developmentDoneAt: null,
    assignments: [member("PM", PM_ID)],
    documents: [],
    submissions: [],
    staffing: null,
    techInfo: null,
    blockers: [],
    milestones: [],
    terms: [],
    handover: null,
    disbursement: null,
    stageDeadlines: {},
    stageCompletedAt: {},
    ...overrides,
  };
}

/**
 * Project yang sudah melewati Stage 1-4: Requirement selesai, Charter dan MoU
 * disetujui, MoU ditandatangani, satu developer dengan kontrak bertanda tangan,
 * dan Finance POC sudah ditunjuk.
 */
export function projectThroughStage4(
  overrides: Partial<ProjectSnapshot> = {},
): ProjectSnapshot {
  const charter = doc("PROJECT_CHARTER");
  const mou = doc("MOU", { signedAt: day("2026-09-05") });
  const contract = doc("PROGRAMMER_CONTRACT", {
    developerId: DEV_ID,
    signedAt: day("2026-09-08"),
  });
  return emptyProject({
    stage1DoneAt: day("2026-08-05"),
    assignments: [
      member("PM", PM_ID),
      member("DEVELOPER", DEV_ID),
      member("FINANCE_POC", FIN_ID),
    ],
    documents: [doc("REQUIREMENT_GATHERING"), charter, mou, contract],
    submissions: [
      submission("PROJECT_CHARTER", charter, "APPROVED"),
      submission("MOU", mou, "APPROVED"),
      submission("PROGRAMMER_CONTRACT", contract, "APPROVED"),
    ],
    staffing: {
      technicalNeeds: "Web app",
      roleRequested: "Full-stack Developer",
      headcount: 1,
      neededBy: day("2026-09-10"),
      status: "DEVELOPER_ASSIGNED",
      submittedAt: day("2026-09-05"),
      assignedByName: "Adnan",
      assignedAt: day("2026-09-06"),
    },
    terms: [
      term(1, "NOT_STARTED", { percentage: 30 }),
      term(2, "NOT_STARTED", { percentage: 40, amount: 6_000_000 }),
      term(3, "NOT_STARTED", { name: "Termin 3 (Final)", percentage: 30 }),
    ],
    ...overrides,
  });
}
