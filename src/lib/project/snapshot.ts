/**
 * Potret data satu project dalam bentuk objek biasa.
 *
 * Server membangunnya dari basis data (src/server/project/snapshot.ts), lalu
 * seluruh aturan turunan, status stage, status project, deadline terdekat,
 * checklist penutupan, dihitung dari potret ini. Karena murni, aturannya bisa
 * diuji tanpa basis data.
 */

import type { ProjectRole } from "@/lib/auth/types";
import type { TermStep } from "@/lib/finance/terms";
import { daysUntil } from "@/lib/time";
import type { DocumentKind, DocumentStatus, UatStatus } from "./catalog";

export interface AssignmentSnapshot {
  userId: string;
  name: string;
  role: ProjectRole;
  techRole: string | null;
  /**
   * Akunnya aktif dan masih memegang jabatan yang sesuai dengan perannya di
   * project. Bila tidak, project "Perlu Penugasan Ulang" dan penugasan ini
   * tidak lagi memberi hak edit.
   */
  userActive: boolean;
  startedAt: Date;
}

export interface DocumentSnapshot {
  id: string;
  kind: DocumentKind;
  /** Kosong kecuali Kontrak Programmer. */
  developerId: string;
  url: string | null;
  status: DocumentStatus;
  deadline: Date | null;
  signedAt: Date | null;
  ownerId: string | null;
  ownerName: string | null;
  updatedAt: Date;
}

export type SubmissionKind = "PROJECT_CHARTER" | "MOU" | "PROGRAMMER_CONTRACT";
export type SubmissionStatus = "PENDING" | "APPROVED" | "REJECTED";

export interface SubmissionSnapshot {
  id: string;
  kind: SubmissionKind;
  documentId: string;
  status: SubmissionStatus;
  submittedById: string;
  submittedByName: string;
  submittedAt: Date;
  decidedById: string | null;
  decidedByName: string | null;
  decidedAt: Date | null;
  feedback: string | null;
}

export interface TermSnapshot {
  id: string;
  sequence: number;
  name: string;
  percentage: number;
  amount: number;
  dueDate: Date | null;
  dueNote: string | null;
  step: TermStep;
  feedback: string | null;
  invoiceRequestUrl: string | null;
  approvedInvoiceUrl: string | null;
  transferProofUrl: string | null;
  receiptUrl: string | null;
  completedAt: Date | null;
  updatedAt: Date;
}

export type StaffingStatus = "WAITING_TECHDEV" | "DEVELOPER_ASSIGNED";

export interface StaffingSnapshot {
  technicalNeeds: string;
  roleRequested: string;
  headcount: number;
  neededBy: Date;
  status: StaffingStatus;
  submittedAt: Date;
  assignedByName: string | null;
  assignedAt: Date | null;
}

export interface TechInfoSnapshot {
  githubRepo: string | null;
  sprintPlanning: string | null;
  currentSprint: string | null;
  progressPercent: number | null;
  nextMilestone: string | null;
  latestUpdate: string | null;
  latestUpdateAt: Date | null;
}

export interface BlockerSnapshot {
  id: string;
  description: string;
  resolvedAt: Date | null;
  createdByName: string;
  createdAt: Date;
}

export interface MilestoneSnapshot {
  id: string;
  name: string;
  date: Date;
  doneAt: Date | null;
}

export interface HandoverSnapshot {
  uatStatus: UatStatus;
  warrantyStart: Date | null;
  warrantyEnd: Date | null;
}

export type DisbursementStatus =
  | "SUBMITTED"
  | "VERIFIED"
  | "APPROVED"
  | "DISBURSED"
  | "REJECTED";

export interface DisbursementSnapshot {
  status: DisbursementStatus;
  feedback: string | null;
  submittedAt: Date;
  verifiedAt: Date | null;
  decidedAt: Date | null;
  decidedByName: string | null;
  disbursedAt: Date | null;
}

export interface ProjectSnapshot {
  id: string;
  code: string;
  name: string;
  client: string;
  type: string | null;
  source: string | null;
  targetStart: Date;
  targetEnd: Date;
  internalNote: string | null;
  createdAt: Date;
  closedAt: Date | null;
  finalStatus: "EARLY" | "ON_TIME" | "LATE" | null;
  stage1DoneAt: Date | null;
  developmentDoneAt: Date | null;

  /** Hanya penugasan yang masih berjalan. */
  assignments: AssignmentSnapshot[];
  documents: DocumentSnapshot[];
  /** Diurutkan dari yang paling lama diajukan. */
  submissions: SubmissionSnapshot[];
  staffing: StaffingSnapshot | null;
  techInfo: TechInfoSnapshot | null;
  blockers: BlockerSnapshot[];
  milestones: MilestoneSnapshot[];
  /** Diurutkan menurut `sequence`. */
  terms: TermSnapshot[];
  handover: HandoverSnapshot | null;
  disbursement: DisbursementSnapshot | null;
  stageDeadlines: Partial<Record<number, Date>>;
  /** Waktu selesai yang sudah tercatat permanen per stage. */
  stageCompletedAt: Partial<Record<number, Date>>;
}

// ─── Pembaca umum ──────────────────────────────────────────────────────────

export function pmOf(project: ProjectSnapshot): AssignmentSnapshot | null {
  return project.assignments.find((a) => a.role === "PM") ?? null;
}

export function financePocOf(
  project: ProjectSnapshot,
): AssignmentSnapshot | null {
  return project.assignments.find((a) => a.role === "FINANCE_POC") ?? null;
}

export function developersOf(project: ProjectSnapshot): AssignmentSnapshot[] {
  return project.assignments.filter((a) => a.role === "DEVELOPER");
}

export function documentOf(
  project: ProjectSnapshot,
  kind: DocumentKind,
  developerId = "",
): DocumentSnapshot | null {
  return (
    project.documents.find(
      (d) => d.kind === kind && d.developerId === developerId,
    ) ?? null
  );
}

/** Pengajuan terakhir untuk satu dokumen, atau `null` bila belum pernah. */
export function latestSubmission(
  project: ProjectSnapshot,
  documentId: string | undefined,
): SubmissionSnapshot | null {
  if (!documentId) return null;
  const list = project.submissions.filter((s) => s.documentId === documentId);
  return list.at(-1) ?? null;
}

export function hasLink(doc: DocumentSnapshot | null): boolean {
  return Boolean(doc?.url);
}

export type WarrantyStatus = "NOT_STARTED" | "ACTIVE" | "DONE";

export const WARRANTY_STATUS_LABELS: Record<WarrantyStatus, string> = {
  NOT_STARTED: "Belum Dimulai",
  ACTIVE: "Aktif",
  DONE: "Selesai",
};

/**
 * Status garansi berubah otomatis dari tanggal (PRD bab 4.10). Tanggal akhir
 * inklusif: garansi baru Selesai sehari setelah Akhir Garansi (WIB).
 */
export function warrantyStatus(
  handover: HandoverSnapshot | null,
  now: Date,
): WarrantyStatus {
  if (!handover?.warrantyStart || !handover.warrantyEnd) return "NOT_STARTED";
  if (daysUntil(handover.warrantyStart, now) > 0) return "NOT_STARTED";
  if (daysUntil(handover.warrantyEnd, now) >= 0) return "ACTIVE";
  return "DONE";
}
