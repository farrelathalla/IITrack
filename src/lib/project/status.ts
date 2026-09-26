/**
 * Status project, deadline terdekat, next action, dan penanggung jawab saat
 * ini (PRD bab 8.1 dan 9). Semuanya dihitung dari potret project.
 */

import type { RoleName } from "@/lib/auth/types";
import {
  isAwaitingFinance,
  isDownPayment,
  stageOfTerm,
  type TermStep,
} from "@/lib/finance/terms";
import { daysUntil, formatDate } from "@/lib/time";
import { DOCUMENTS, type StageNumber, stageDefinition } from "./catalog";
import {
  type AssignmentSnapshot,
  developersOf,
  documentOf,
  financePocOf,
  latestSubmission,
  type ProjectSnapshot,
  pmOf,
  type TermSnapshot,
  warrantyStatus,
} from "./snapshot";
import { currentStage, isStageUnlocked, type StageState } from "./stages";

// ─── Penanggung jawab ──────────────────────────────────────────────────────

export interface Responsible {
  /** Kosong bila yang harus bertindak adalah jabatan, bukan orang tertentu. */
  userId: string | null;
  name: string;
  divisionLabel: string;
  /** Jabatan yang boleh bertindak bila `userId` kosong. */
  roles: readonly RoleName[];
}

const OPS_LEAD: Responsible = {
  userId: null,
  name: "COO / Vice COO",
  divisionLabel: "Operasional",
  roles: ["COO", "VICE_COO"],
};

const TECH_LEAD: Responsible = {
  userId: null,
  name: "CTO / Vice CTO",
  divisionLabel: "Tech Development",
  roles: ["CTO", "VICE_CTO"],
};

const FINANCE_LEAD: Responsible = {
  userId: null,
  name: "CFO / Vice CFO",
  divisionLabel: "Finance",
  roles: ["CFO", "VICE_CFO"],
};

function person(
  assignment: AssignmentSnapshot | null,
  divisionLabel: string,
  fallback: Responsible,
): Responsible {
  if (!assignment) return fallback;
  return {
    userId: assignment.userId,
    name: assignment.name,
    divisionLabel,
    roles: [],
  };
}

function pmResponsible(project: ProjectSnapshot): Responsible {
  return person(pmOf(project), "Project Management", OPS_LEAD);
}

function financeResponsible(project: ProjectSnapshot): Responsible {
  return person(financePocOf(project), "Finance", FINANCE_LEAD);
}

function techResponsible(project: ProjectSnapshot): Responsible {
  return person(
    developersOf(project)[0] ?? null,
    "Tech Development",
    TECH_LEAD,
  );
}

// ─── Next action ───────────────────────────────────────────────────────────

export interface NextAction {
  label: string;
  responsible: Responsible;
  stage: StageNumber;
}

function termLabel(term: TermSnapshot): string {
  return isDownPayment(term.sequence) ? "DP" : term.name;
}

function termAction(
  project: ProjectSnapshot,
  term: TermSnapshot,
  stage: StageNumber,
): NextAction {
  const name = termLabel(term);
  const pm = pmResponsible(project);
  const finance = financeResponsible(project);
  const byStep: Record<TermStep, [string, Responsible]> = {
    NOT_STARTED: [
      term.feedback
        ? `Perbaiki dan minta ulang invoice ${name}`
        : `Minta invoice ${name}`,
      pm,
    ],
    INVOICE_REQUESTED: [`Proses invoice ${name}`, finance],
    PROCESSING: [`Setujui invoice ${name}`, finance],
    INVOICE_APPROVED: [`Kirim invoice ${name} ke client`, finance],
    SENT_TO_CLIENT: [
      term.feedback
        ? `Perbaiki bukti transfer ${name}`
        : `Tambah bukti transfer ${name}`,
      pm,
    ],
    PROOF_SUBMITTED: [`Verifikasi pembayaran ${name}`, finance],
    PAYMENT_RECEIVED: [`Terbitkan kwitansi ${name}`, finance],
    RECEIPT_ISSUED: [`Selesaikan termin ${name}`, finance],
    DONE: [`Termin ${name} lunas`, finance],
  };
  const [label, responsible] = byStep[term.step];
  return { label, responsible, stage };
}

function documentApproval(
  project: ProjectSnapshot,
  kind: "PROJECT_CHARTER" | "MOU",
  stage: StageNumber,
): NextAction {
  const pm = pmResponsible(project);
  const doc = documentOf(project, kind);
  const sub = latestSubmission(project, doc?.id);
  const name = kind === "MOU" ? "MoU" : "Project Charter";

  if (sub?.status === "PENDING") {
    return {
      label: `Menunggu persetujuan ${name}`,
      responsible: OPS_LEAD,
      stage,
    };
  }
  if (sub?.status === "REJECTED") {
    return { label: `Revisi ${name} dan ajukan ulang`, responsible: pm, stage };
  }
  if (sub?.status === "APPROVED" && kind === "MOU") {
    return {
      label: "Upload MoU yang telah ditandatangani",
      responsible: pm,
      stage,
    };
  }
  if (!doc?.url) {
    return {
      label:
        kind === "MOU"
          ? "Tautkan MoU dan isi termin pembayaran"
          : "Tautkan Project Charter",
      responsible: pm,
      stage,
    };
  }
  return { label: `Ajukan ${name} untuk persetujuan`, responsible: pm, stage };
}

export function nextAction(
  project: ProjectSnapshot,
  stages: readonly StageState[],
  now: Date,
): NextAction | null {
  if (project.closedAt) return null;

  const current = currentStage(stages);
  const n = current.n;
  const pm = pmResponsible(project);

  switch (n) {
    case 1:
      return documentOf(project, "REQUIREMENT_GATHERING")?.url
        ? {
            label: "Tandai Requirement Gathering selesai",
            responsible: pm,
            stage: 1,
          }
        : {
            label: "Tautkan Requirement Gathering Document",
            responsible: pm,
            stage: 1,
          };
    case 2:
      return documentApproval(project, "PROJECT_CHARTER", 2);
    case 3:
      return documentApproval(project, "MOU", 3);
    case 4: {
      if (!project.staffing) {
        return { label: "Kirim Request SDM", responsible: pm, stage: 4 };
      }
      if (project.staffing.status === "WAITING_TECHDEV") {
        return {
          label: "Tugaskan developer",
          responsible: TECH_LEAD,
          stage: 4,
        };
      }
      const developers = developersOf(project);
      if (developers.length === 0) {
        return {
          label: "Tugaskan developer",
          responsible: TECH_LEAD,
          stage: 4,
        };
      }
      const contracts = developers.map((d) => {
        const doc = documentOf(project, "PROGRAMMER_CONTRACT", d.userId);
        return { doc, sub: latestSubmission(project, doc?.id) };
      });
      if (contracts.some((c) => c.sub?.status === "REJECTED")) {
        return {
          label: "Revisi Kontrak Programmer dan ajukan ulang",
          responsible: pm,
          stage: 4,
        };
      }
      if (contracts.some((c) => !c.doc?.url)) {
        return {
          label: "Tautkan Kontrak Programmer",
          responsible: pm,
          stage: 4,
        };
      }
      if (contracts.some((c) => !c.sub)) {
        return {
          label: "Ajukan Kontrak Programmer untuk persetujuan",
          responsible: pm,
          stage: 4,
        };
      }
      if (contracts.some((c) => c.sub?.status === "PENDING")) {
        return {
          label: "Menunggu persetujuan Kontrak Programmer",
          responsible: TECH_LEAD,
          stage: 4,
        };
      }
      return {
        label: "Tandai Kontrak Programmer ditandatangani",
        responsible: pm,
        stage: 4,
      };
    }
    case 5: {
      if (!financePocOf(project)) {
        return {
          label: "Tunjuk Finance POC",
          responsible: FINANCE_LEAD,
          stage: 5,
        };
      }
      const dp = project.terms.find((t) => t.sequence === 1);
      if (!dp) {
        return {
          label: "Termin DP belum diisi",
          responsible: FINANCE_LEAD,
          stage: 5,
        };
      }
      return termAction(project, dp, 5);
    }
    case 6: {
      const active = openTermsInStage(project, 6).find(
        (t) => t.step !== "NOT_STARTED",
      );
      if (active) return termAction(project, active, 6);
      if (!project.techInfo?.githubRepo) {
        return {
          label: "Tautkan GitHub Repository dan Sprint Planning",
          responsible: techResponsible(project),
          stage: 6,
        };
      }
      const due = openTermsInStage(project, 6).find(
        (t) => t.dueDate && daysUntil(t.dueDate, now) <= 7,
      );
      if (due) return termAction(project, due, 6);
      return {
        label: "Update progress pengembangan",
        responsible: techResponsible(project),
        stage: 6,
      };
    }
    case 7: {
      const bast = documentOf(project, "BAST");
      if (!bast?.url) {
        return { label: "Tautkan BAST", responsible: pm, stage: 7 };
      }
      if (!bast.signedAt) {
        return {
          label: "Tandai BAST ditandatangani",
          responsible: pm,
          stage: 7,
        };
      }
      if (!project.handover?.warrantyStart || !project.handover.warrantyEnd) {
        return { label: "Isi masa garansi", responsible: pm, stage: 7 };
      }
      const final = openTermsInStage(project, 7)[0];
      if (final) return termAction(project, final, 7);
      if (warrantyStatus(project.handover, now) !== "DONE") {
        return {
          label: `Pantau garansi sampai ${formatDate(project.handover.warrantyEnd)}`,
          responsible: pm,
          stage: 7,
        };
      }
      return { label: "Lengkapi Handover", responsible: pm, stage: 7 };
    }
    case 8:
      return {
        label: "Tambahkan Client Feedback dan Programmer Feedback",
        responsible: pm,
        stage: 8,
      };
    case 9: {
      const disb = project.disbursement;
      const finance = financeResponsible(project);
      if (
        !documentOf(project, "PROJECT_DOCUMENTATION")?.url ||
        !documentOf(project, "SOURCE_CODE_DOCUMENTATION")?.url
      ) {
        if (!disb) {
          return {
            label: "Tautkan dokumentasi project",
            responsible: pm,
            stage: 9,
          };
        }
      }
      if (!disb) {
        return {
          label: "Ajukan Finance Disbursement",
          responsible: pm,
          stage: 9,
        };
      }
      switch (disb.status) {
        case "SUBMITTED":
          return {
            label: "Verifikasi Finance Disbursement",
            responsible: finance,
            stage: 9,
          };
        case "VERIFIED":
          return {
            label: "Setujui Finance Disbursement",
            responsible: FINANCE_LEAD,
            stage: 9,
          };
        case "APPROVED":
          return {
            label: "Tandai dana dicairkan",
            responsible: finance,
            stage: 9,
          };
        case "REJECTED":
          return {
            label: "Perbaiki dan ajukan ulang Finance Disbursement",
            responsible: pm,
            stage: 9,
          };
        case "DISBURSED":
          return {
            label: "Tandai project sebagai selesai",
            responsible: pm,
            stage: 9,
          };
      }
    }
  }
}

function openTermsInStage(
  project: ProjectSnapshot,
  stage: StageNumber,
): TermSnapshot[] {
  const total = project.terms.length;
  return project.terms.filter(
    (t) => stageOfTerm(t.sequence, total) === stage && t.step !== "DONE",
  );
}

/** Apakah next action project ini menunggu orang tersebut. */
export function isAwaitingUser(
  action: NextAction | null,
  userId: string,
  role: RoleName | null,
): boolean {
  if (!action) return false;
  if (action.responsible.userId) return action.responsible.userId === userId;
  return role !== null && action.responsible.roles.includes(role);
}

// ─── Deadline ──────────────────────────────────────────────────────────────

export interface DeadlineItem {
  date: Date;
  label: string;
  stage: StageNumber;
  responsible: Responsible;
}

function documentDone(
  project: ProjectSnapshot,
  kind: keyof typeof DOCUMENTS,
  developerId = "",
): boolean {
  const doc = documentOf(project, kind, developerId);
  if (!doc) return false;
  switch (kind) {
    case "PROJECT_CHARTER":
      return latestSubmission(project, doc.id)?.status === "APPROVED";
    case "MOU":
    case "PROGRAMMER_CONTRACT":
    case "BAST":
      return Boolean(doc.signedAt);
    default:
      return doc.status === "DONE" || Boolean(doc.url);
  }
}

/**
 * Semua item terbuka yang punya tenggat: dokumen, tenggat stage, termin, dan
 * milestone. Hanya dari stage yang sudah terbuka dan belum selesai.
 */
export function openDeadlines(
  project: ProjectSnapshot,
  stages: readonly StageState[],
): DeadlineItem[] {
  if (project.closedAt) return [];

  const items: DeadlineItem[] = [];
  const pm = pmResponsible(project);
  const openStage = (n: StageNumber) =>
    isStageUnlocked(stages, n) &&
    stages.find((s) => s.n === n)?.status !== "completed";

  for (const stage of stages) {
    if (!openStage(stage.n) || !stage.deadline) continue;
    const def = stageDefinition(stage.n);
    items.push({
      date: stage.deadline,
      label: `${def.shortName} (Stage ${def.n})`,
      stage: stage.n,
      responsible: pm,
    });
  }

  for (const doc of project.documents) {
    const def = DOCUMENTS[doc.kind];
    if (!doc.deadline || !openStage(def.stage)) continue;
    if (documentDone(project, doc.kind, doc.developerId)) continue;
    const owner = doc.ownerId
      ? project.assignments.find((a) => a.userId === doc.ownerId)
      : null;
    items.push({
      date: doc.deadline,
      label:
        doc.kind === "MOU" ? "Upload MoU Ditandatangani" : `Upload ${def.name}`,
      stage: def.stage,
      responsible: owner ? person(owner, "Project Management", pm) : pm,
    });
  }

  const total = project.terms.length;
  for (const term of project.terms) {
    const stage = stageOfTerm(term.sequence, total);
    if (!term.dueDate || term.step === "DONE") continue;
    if (!isStageUnlocked(stages, stage)) continue;
    items.push({
      date: term.dueDate,
      label: `Pembayaran ${term.name}`,
      stage,
      responsible: isAwaitingFinance(term.step)
        ? financeResponsible(project)
        : pm,
    });
  }

  const current = currentStage(stages).n;
  for (const milestone of project.milestones) {
    if (milestone.doneAt) continue;
    items.push({
      date: milestone.date,
      label: milestone.name,
      stage: current,
      responsible: pm,
    });
  }

  return items.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export type Urgency = "overdue" | "today" | "tomorrow" | "soon" | "normal";

export function urgencyOf(date: Date, now: Date): Urgency {
  const days = daysUntil(date, now);
  if (days < 0) return "overdue";
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  if (days < 7) return "soon";
  return "normal";
}

/** Chip urgensi: "Overdue", "Hari ini", "Besok", "n hari". */
export function urgencyLabel(date: Date, now: Date): string {
  const days = daysUntil(date, now);
  if (days < 0) return "Overdue";
  if (days === 0) return "Hari ini";
  if (days === 1) return "Besok";
  return `${days} hari`;
}

// ─── Status project ────────────────────────────────────────────────────────

export type ProjectStatus =
  | "ACTION_REQUIRED"
  | "WAITING_APPROVAL"
  | "AT_RISK"
  | "ON_TRACK";

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  ACTION_REQUIRED: "Action Required",
  WAITING_APPROVAL: "Waiting Approval",
  AT_RISK: "At Risk",
  ON_TRACK: "On Track",
};

/**
 * Status dengan urutan teratas yang berlaku (PRD bab 9): revisi atau
 * deadline lewat, lalu menunggu approver, lalu deadline kurang dari 3 hari.
 */
export function projectStatus(
  stages: readonly StageState[],
  deadlines: readonly DeadlineItem[],
  now: Date,
): ProjectStatus {
  if (
    stages.some((s) => s.status === "revision-required") ||
    deadlines.some((d) => daysUntil(d.date, now) < 0)
  ) {
    return "ACTION_REQUIRED";
  }
  if (stages.some((s) => s.status === "waiting-approval")) {
    return "WAITING_APPROVAL";
  }
  const nearest = deadlines[0];
  if (nearest && daysUntil(nearest.date, now) < 3) return "AT_RISK";
  return "ON_TRACK";
}

// ─── Ringkasan satu project untuk daftar dan dashboard ────────────────────

export interface ProjectSummary {
  status: ProjectStatus | null;
  current: StageState;
  completed: number;
  nearestDeadline: DeadlineItem | null;
  nextAction: NextAction | null;
  /** Penugasan yang orangnya sudah tidak aktif. */
  needsReassignment: AssignmentSnapshot[];
}

export function summarize(
  project: ProjectSnapshot,
  stages: readonly StageState[],
  now: Date,
): ProjectSummary {
  const deadlines = openDeadlines(project, stages);
  return {
    status: project.closedAt ? null : projectStatus(stages, deadlines, now),
    current: currentStage(stages),
    completed: stages.filter((s) => s.status === "completed").length,
    nearestDeadline: deadlines[0] ?? null,
    nextAction: nextAction(project, stages, now),
    needsReassignment: project.closedAt
      ? []
      : project.assignments.filter((a) => !a.userActive),
  };
}
