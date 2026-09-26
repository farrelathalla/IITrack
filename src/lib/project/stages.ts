/**
 * Status sembilan stage, dihitung dari potret project (PRD bab 4.1–4.2).
 *
 * Aturannya:
 * - Stage berikutnya terkunci sampai stage sebelumnya selesai. Stage 5 juga
 *   menunggu Finance POC ditunjuk.
 * - Stage selesai begitu syaratnya terpenuhi. Waktu selesainya lalu dicatat
 *   permanen oleh server (`stageCompletedAt`), sehingga perubahan belakangan
 *   tidak mengunci ulang stage sesudahnya.
 * - Selain selesai dan terkunci, status diambil dari pengajuan terakhir di
 *   stage itu: revisi > menunggu persetujuan > disetujui > berjalan.
 */

import { isAwaitingFinance, stageOfTerm } from "@/lib/finance/terms";
import {
  STAGES,
  type StageNumber,
  stageDefinition,
  TOTAL_STAGES,
} from "./catalog";
import {
  type DocumentSnapshot,
  developersOf,
  documentOf,
  financePocOf,
  latestSubmission,
  type ProjectSnapshot,
  type SubmissionSnapshot,
  warrantyStatus,
} from "./snapshot";

export type StageStatus =
  | "locked"
  | "not-started"
  | "in-progress"
  | "waiting-approval"
  | "revision-required"
  | "approved"
  | "completed";

export const STAGE_STATUS_LABELS: Record<StageStatus, string> = {
  locked: "Terkunci",
  "not-started": "Belum Dimulai",
  "in-progress": "Sedang Berjalan",
  "waiting-approval": "Menunggu Persetujuan",
  "revision-required": "Revisi Diperlukan",
  approved: "Disetujui",
  completed: "Selesai",
};

export interface StageRejection {
  feedback: string;
  reviewerName: string;
  decidedAt: Date | null;
}

export interface StageState {
  n: StageNumber;
  status: StageStatus;
  /** Alasan terkunci, misalnya "Selesaikan Agreement (Stage 3) terlebih dahulu." */
  lockedReason: string | null;
  completedAt: Date | null;
  deadline: Date | null;
  /** Penolakan terakhir, bila statusnya Revisi Diperlukan. */
  rejection: StageRejection | null;
  /** "COO / Vice COO" dan sejenisnya, bila menunggu persetujuan. */
  waitingFor: string | null;
}

interface Activity {
  status: Exclude<StageStatus, "locked" | "completed">;
  rejection: StageRejection | null;
  waitingFor: string | null;
}

function fromSubmission(
  submission: SubmissionSnapshot | null,
  approver: string,
): Activity | null {
  if (!submission) return null;
  if (submission.status === "PENDING") {
    return {
      status: "waiting-approval",
      rejection: null,
      waitingFor: approver,
    };
  }
  if (submission.status === "REJECTED") {
    return {
      status: "revision-required",
      rejection: {
        feedback: submission.feedback ?? "",
        reviewerName: submission.decidedByName ?? approver,
        decidedAt: submission.decidedAt,
      },
      waitingFor: null,
    };
  }
  return { status: "approved", rejection: null, waitingFor: null };
}

function touched(doc: DocumentSnapshot | null): boolean {
  return Boolean(doc && (doc.url || doc.status !== "MISSING"));
}

const PRIORITY: Record<Activity["status"], number> = {
  "revision-required": 4,
  "waiting-approval": 3,
  approved: 2,
  "in-progress": 1,
  "not-started": 0,
};

function strongest(items: (Activity | null)[]): Activity {
  let best: Activity = {
    status: "not-started",
    rejection: null,
    waitingFor: null,
  };
  for (const item of items) {
    if (item && PRIORITY[item.status] > PRIORITY[best.status]) best = item;
  }
  return best;
}

const IN_PROGRESS: Activity = {
  status: "in-progress",
  rejection: null,
  waitingFor: null,
};

// ─── Syarat selesai per stage ──────────────────────────────────────────────

/** Waktu syarat stage terpenuhi, atau `null` bila belum. */
export function requirementMetAt(
  project: ProjectSnapshot,
  n: StageNumber,
  now: Date,
): Date | null {
  switch (n) {
    case 1:
      return project.stage1DoneAt;
    case 2: {
      const charter = documentOf(project, "PROJECT_CHARTER");
      const sub = latestSubmission(project, charter?.id);
      return sub?.status === "APPROVED" ? sub.decidedAt : null;
    }
    case 3: {
      const mou = documentOf(project, "MOU");
      const sub = latestSubmission(project, mou?.id);
      return sub?.status === "APPROVED" && mou?.signedAt ? mou.signedAt : null;
    }
    case 4: {
      if (project.staffing?.status !== "DEVELOPER_ASSIGNED") return null;
      const developers = developersOf(project);
      if (developers.length === 0) return null;
      let latest: Date | null = null;
      for (const developer of developers) {
        const contract = documentOf(
          project,
          "PROGRAMMER_CONTRACT",
          developer.userId,
        );
        const sub = latestSubmission(project, contract?.id);
        if (sub?.status !== "APPROVED" || !contract?.signedAt) return null;
        if (!latest || contract.signedAt > latest) latest = contract.signedAt;
      }
      return latest;
    }
    case 5: {
      const dp = project.terms.find((t) => t.sequence === 1);
      return dp?.step === "DONE" ? (dp.completedAt ?? dp.updatedAt) : null;
    }
    case 6:
      return project.developmentDoneAt;
    case 7: {
      const bast = documentOf(project, "BAST");
      if (!bast?.signedAt) return null;
      const total = project.terms.length;
      const final = project.terms.find((t) => t.sequence === total);
      if (final?.step !== "DONE") return null;
      if (warrantyStatus(project.handover, now) !== "DONE") return null;
      return maxDate([
        bast.signedAt,
        final.completedAt ?? final.updatedAt,
        project.handover?.warrantyEnd ?? null,
      ]);
    }
    case 8: {
      const client = documentOf(project, "CLIENT_FEEDBACK");
      const programmer = documentOf(project, "PROGRAMMER_FEEDBACK");
      if (!isFeedbackComplete(client) || !isFeedbackComplete(programmer)) {
        return null;
      }
      return maxDate([
        client?.updatedAt ?? null,
        programmer?.updatedAt ?? null,
      ]);
    }
    case 9:
      return project.closedAt;
  }
}

export function isFeedbackComplete(doc: DocumentSnapshot | null): boolean {
  return Boolean(doc?.url) && doc?.status === "DONE";
}

// ─── Aktivitas per stage (bila belum selesai) ─────────────────────────────

function activityOf(project: ProjectSnapshot, n: StageNumber): Activity {
  switch (n) {
    case 1: {
      const doc = documentOf(project, "REQUIREMENT_GATHERING");
      return touched(doc) ? IN_PROGRESS : strongest([]);
    }
    case 2: {
      const charter = documentOf(project, "PROJECT_CHARTER");
      const sub = fromSubmission(
        latestSubmission(project, charter?.id),
        "COO / Vice COO",
      );
      return strongest([
        sub,
        touched(charter) || touched(documentOf(project, "GANTT_CHART"))
          ? IN_PROGRESS
          : null,
      ]);
    }
    case 3: {
      const mou = documentOf(project, "MOU");
      const sub = fromSubmission(
        latestSubmission(project, mou?.id),
        "COO / Vice COO",
      );
      return strongest([
        sub,
        touched(mou) || project.terms.length > 0 ? IN_PROGRESS : null,
      ]);
    }
    case 4: {
      const items: (Activity | null)[] = [];
      if (project.staffing?.status === "WAITING_TECHDEV") {
        items.push({
          status: "waiting-approval",
          rejection: null,
          waitingFor: "CTO / Vice CTO",
        });
      } else if (project.staffing) {
        items.push(IN_PROGRESS);
      }
      const developers = developersOf(project);
      let allApproved = developers.length > 0;
      for (const developer of developers) {
        const contract = documentOf(
          project,
          "PROGRAMMER_CONTRACT",
          developer.userId,
        );
        const sub = fromSubmission(
          latestSubmission(project, contract?.id),
          "CTO / Vice CTO",
        );
        if (sub?.status !== "approved") allApproved = false;
        // Kontrak yang disetujui dihitung sebagai berjalan di sini; stage baru
        // berstatus Disetujui bila kontrak semua developer sudah disetujui.
        items.push(
          sub && sub.status !== "approved"
            ? sub
            : touched(contract) || sub
              ? IN_PROGRESS
              : null,
        );
      }
      if (allApproved) {
        items.push({ status: "approved", rejection: null, waitingFor: null });
      }
      return strongest(items);
    }
    case 5:
    case 6:
    case 7: {
      const items: (Activity | null)[] = [];
      const total = project.terms.length;
      for (const term of project.terms) {
        if (stageOfTerm(term.sequence, total) !== n) continue;
        if (term.feedback) {
          items.push({
            status: "revision-required",
            rejection: {
              feedback: term.feedback,
              reviewerName: financePocOf(project)?.name ?? "Finance POC",
              decidedAt: term.updatedAt,
            },
            waitingFor: null,
          });
        } else if (isAwaitingFinance(term.step)) {
          items.push({
            status: "waiting-approval",
            rejection: null,
            waitingFor: "Finance POC",
          });
        } else if (term.step !== "NOT_STARTED") {
          items.push(IN_PROGRESS);
        }
      }
      if (n === 6) {
        const tech = project.techInfo;
        if (
          tech &&
          (tech.githubRepo || tech.currentSprint || tech.latestUpdate)
        ) {
          items.push(IN_PROGRESS);
        }
      }
      if (n === 7) {
        if (
          touched(documentOf(project, "BAST")) ||
          touched(documentOf(project, "TESTING_RESULT")) ||
          (project.handover && project.handover.uatStatus !== "NOT_STARTED")
        ) {
          items.push(IN_PROGRESS);
        }
      }
      return strongest(items);
    }
    case 8:
      return touched(documentOf(project, "CLIENT_FEEDBACK")) ||
        touched(documentOf(project, "PROGRAMMER_FEEDBACK"))
        ? IN_PROGRESS
        : strongest([]);
    case 9: {
      const disb = project.disbursement;
      if (disb?.status === "REJECTED") {
        return {
          status: "revision-required",
          rejection: {
            feedback: disb.feedback ?? "",
            reviewerName: disb.decidedByName ?? "CFO / Vice CFO",
            decidedAt: disb.decidedAt,
          },
          waitingFor: null,
        };
      }
      if (disb?.status === "SUBMITTED") {
        return {
          status: "waiting-approval",
          rejection: null,
          waitingFor: "Finance POC (verifikasi)",
        };
      }
      if (disb?.status === "VERIFIED") {
        return {
          status: "waiting-approval",
          rejection: null,
          waitingFor: "CFO / Vice CFO",
        };
      }
      if (
        disb ||
        touched(documentOf(project, "PROJECT_DOCUMENTATION")) ||
        touched(documentOf(project, "SOURCE_CODE_DOCUMENTATION"))
      ) {
        return IN_PROGRESS;
      }
      return strongest([]);
    }
  }
}

// ─── Penurunan status seluruh stage ───────────────────────────────────────

function lockedReasonFor(
  project: ProjectSnapshot,
  n: StageNumber,
  previousComplete: boolean,
): string | null {
  if (!previousComplete) {
    const prev = stageDefinition(n - 1);
    return `Selesaikan ${prev.name} (Stage ${prev.n}) terlebih dahulu.`;
  }
  if (n === 5 && !financePocOf(project)) {
    return "Menunggu CFO/VCFO menunjuk Finance POC.";
  }
  return null;
}

export function deriveStages(
  project: ProjectSnapshot,
  now: Date,
): StageState[] {
  const result: StageState[] = [];
  let previousComplete = true;

  for (const definition of STAGES) {
    const n = definition.n;
    const deadline = project.stageDeadlines[n] ?? null;
    const recorded = project.stageCompletedAt[n] ?? null;
    const lockedReason =
      n === 1 ? null : lockedReasonFor(project, n, previousComplete);

    // Stage yang sudah tercatat selesai tetap selesai, termasuk bila syarat
    // pembukanya kemudian berubah (misalnya Finance POC diganti).
    if (recorded) {
      result.push({
        n,
        status: "completed",
        lockedReason: null,
        completedAt: recorded,
        deadline,
        rejection: null,
        waitingFor: null,
      });
      previousComplete = true;
      continue;
    }

    if (lockedReason) {
      result.push({
        n,
        status: "locked",
        lockedReason,
        completedAt: null,
        deadline,
        rejection: null,
        waitingFor: null,
      });
      previousComplete = false;
      continue;
    }

    const metAt = requirementMetAt(project, n, now);
    if (metAt) {
      result.push({
        n,
        status: "completed",
        lockedReason: null,
        completedAt: metAt,
        deadline,
        rejection: null,
        waitingFor: null,
      });
      previousComplete = true;
      continue;
    }

    const activity = activityOf(project, n);
    result.push({
      n,
      status: activity.status,
      lockedReason: null,
      completedAt: null,
      deadline,
      rejection: activity.rejection,
      waitingFor: activity.waitingFor,
    });
    previousComplete = false;
  }

  return result;
}

/** Stage yang baru selesai tetapi belum tercatat permanen. */
export function newlyCompletedStages(
  project: ProjectSnapshot,
  stages: readonly StageState[],
): StageState[] {
  return stages.filter(
    (stage) =>
      stage.status === "completed" && !project.stageCompletedAt[stage.n],
  );
}

/**
 * Stage yang sedang dikerjakan: stage pertama yang belum selesai. Project yang
 * sudah ditutup berada di Stage 9.
 */
export function currentStage(stages: readonly StageState[]): StageState {
  return (
    stages.find((stage) => stage.status !== "completed") ??
    stages[TOTAL_STAGES - 1]
  );
}

/**
 * Panel default saat Project Detail dibuka: stage yang sedang berjalan,
 * menunggu persetujuan, atau revisi (PRD bab 8.3).
 */
export function defaultPanelStage(stages: readonly StageState[]): StageNumber {
  const active = stages.find(
    (stage) =>
      stage.status === "in-progress" ||
      stage.status === "waiting-approval" ||
      stage.status === "revision-required" ||
      stage.status === "approved" ||
      stage.status === "not-started",
  );
  return active?.n ?? currentStage(stages).n;
}

export function completedCount(stages: readonly StageState[]): number {
  return stages.filter((stage) => stage.status === "completed").length;
}

export function isStageUnlocked(
  stages: readonly StageState[],
  n: StageNumber,
): boolean {
  const stage = stages.find((s) => s.n === n);
  return Boolean(stage && stage.status !== "locked");
}

function maxDate(dates: (Date | null)[]): Date | null {
  let best: Date | null = null;
  for (const date of dates) {
    if (date && (!best || date > best)) best = date;
  }
  return best;
}
