"use server";

/**
 * Server Action Project Detail. Setiap fungsi hanya meneruskan ke modul
 * src/server yang memeriksa izin di server, lalu menyegarkan halaman. Tidak
 * ada pemeriksaan izin di sini maupun di tampilan yang dijadikan pengaman.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Actor, ProjectRole } from "@/lib/auth/types";
import type { TermAction } from "@/lib/finance/terms";
import type { DocumentKind, UatStatus } from "@/lib/project/catalog";
import { requireActionUser } from "@/server/auth/current";
import {
  assignDevelopers,
  assignFinancePoc,
  assignPm,
  replaceDeveloper,
} from "@/server/project/assignments";
import {
  deleteProject,
  type ProjectDetailsInput,
  updateProjectDetails,
} from "@/server/project/details";
import {
  completeStage1,
  decideSubmission,
  markSigned,
  type SaveDocumentInput,
  saveDocument,
  submitDocument,
} from "@/server/project/documents";
import { type ActionResult, runAction } from "@/server/project/mutate";
import {
  addMilestone,
  closeProject,
  decideDisbursement,
  markDevelopmentDone,
  markDisbursed,
  removeMilestone,
  setStageDeadline,
  setUatStatus,
  setWarranty,
  submitDisbursement,
  toggleMilestone,
  updateLatestUpdate,
  verifyDisbursement,
} from "@/server/project/operations";
import { type Candidate, candidatesFor } from "@/server/project/people";
import {
  addBlocker,
  resolveBlocker,
  type StaffingInput,
  submitStaffing,
  type TechInfoInput,
  updateTechInfo,
} from "@/server/project/tech";
import {
  saveTerms,
  type TermInput,
  transitionTerm,
} from "@/server/project/terms";

async function act(
  code: string,
  fn: (actor: Actor) => Promise<unknown>,
  message?: string,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    const { actor } = await requireActionUser();
    await fn(actor);
    return message;
  });
  if (result.ok) {
    revalidatePath(`/projects/${code}`);
    revalidatePath("/", "layout");
  }
  return result;
}

export async function candidatesAction(
  role: ProjectRole,
): Promise<Candidate[]> {
  await requireActionUser();
  return candidatesFor(role);
}

// ─── Detail project ───────────────────────────────────────────────────────

export async function updateDetailsAction(
  code: string,
  input: ProjectDetailsInput,
) {
  return act(
    code,
    (actor) => updateProjectDetails({ actor, projectId: code, input }),
    "Detail project disimpan.",
  );
}

export async function deleteProjectAction(
  code: string,
  reason: string,
): Promise<ActionResult> {
  const result = await act(code, (actor) =>
    deleteProject({ actor, projectId: code, reason }),
  );
  // redirect melempar ke luar, jadi harus di luar runAction.
  if (result.ok) redirect("/projects?dihapus=1");
  return result;
}

// ─── Dokumen dan pengajuan ────────────────────────────────────────────────

export async function saveDocumentAction(
  code: string,
  input: SaveDocumentInput,
) {
  return act(
    code,
    (actor) => saveDocument({ actor, projectId: code, input }),
    "Dokumen disimpan.",
  );
}

export async function completeStage1Action(code: string) {
  return act(
    code,
    (actor) => completeStage1({ actor, projectId: code }),
    "Stage 1 ditandai selesai.",
  );
}

export async function submitDocumentAction(
  code: string,
  kind: DocumentKind,
  developerId?: string,
) {
  return act(
    code,
    (actor) => submitDocument({ actor, projectId: code, kind, developerId }),
    "Pengajuan terkirim.",
  );
}

export async function decideSubmissionAction(
  code: string,
  submissionId: string,
  decision: "APPROVE" | "REJECT",
  feedback?: string,
) {
  return act(
    code,
    (actor) =>
      decideSubmission({
        actor,
        projectId: code,
        submissionId,
        decision,
        feedback,
      }),
    decision === "APPROVE" ? "Pengajuan disetujui." : "Pengajuan ditolak.",
  );
}

export async function markSignedAction(
  code: string,
  kind: "MOU" | "PROGRAMMER_CONTRACT" | "BAST",
  developerId?: string,
) {
  return act(
    code,
    (actor) => markSigned({ actor, projectId: code, kind, developerId }),
    "Ditandai ditandatangani.",
  );
}

// ─── Termin ──────────────────────────────────────────────────────────────

export async function saveTermsAction(code: string, terms: TermInput[]) {
  return act(
    code,
    (actor) => saveTerms({ actor, projectId: code, terms }),
    "Termin disimpan.",
  );
}

export async function termAction(
  code: string,
  termId: string,
  action: TermAction,
  options: { feedback?: string; url?: string } = {},
) {
  return act(code, (actor) =>
    transitionTerm({ actor, projectId: code, termId, action, ...options }),
  );
}

// ─── Penugasan ───────────────────────────────────────────────────────────

export async function assignPmAction(code: string, userId: string) {
  return act(
    code,
    (actor) => assignPm({ actor, projectId: code, userId }),
    "PM diganti.",
  );
}

export async function assignDevelopersAction(
  code: string,
  developers: { userId: string; techRole: string }[],
) {
  return act(
    code,
    (actor) => assignDevelopers({ actor, projectId: code, developers }),
    "Developer ditugaskan.",
  );
}

export async function replaceDeveloperAction(
  code: string,
  previousUserId: string,
  userId: string,
  techRole: string,
) {
  return act(
    code,
    (actor) =>
      replaceDeveloper({
        actor,
        projectId: code,
        previousUserId,
        userId,
        techRole,
      }),
    "Developer diganti.",
  );
}

export async function assignFinancePocAction(code: string, userId: string) {
  return act(
    code,
    (actor) => assignFinancePoc({ actor, projectId: code, userId }),
    "Finance POC ditunjuk.",
  );
}

// ─── Tech Development ────────────────────────────────────────────────────

export async function submitStaffingAction(code: string, input: StaffingInput) {
  return act(
    code,
    (actor) => submitStaffing({ actor, projectId: code, input }),
    "Request SDM terkirim.",
  );
}

export async function updateTechInfoAction(code: string, input: TechInfoInput) {
  return act(
    code,
    (actor) => updateTechInfo({ actor, projectId: code, input }),
    "Data teknis disimpan.",
  );
}

export async function addBlockerAction(code: string, description: string) {
  return act(
    code,
    (actor) => addBlocker({ actor, projectId: code, description }),
    "Blocker ditambahkan.",
  );
}

export async function resolveBlockerAction(code: string, blockerId: string) {
  return act(code, (actor) =>
    resolveBlocker({ actor, projectId: code, blockerId }),
  );
}

// ─── Operasional ─────────────────────────────────────────────────────────

export async function latestUpdateAction(code: string, text: string) {
  return act(
    code,
    (actor) => updateLatestUpdate({ actor, projectId: code, text }),
    "Latest update disimpan.",
  );
}

export async function developmentDoneAction(code: string) {
  return act(
    code,
    (actor) => markDevelopmentDone({ actor, projectId: code }),
    "Pengembangan ditandai selesai.",
  );
}

export async function addMilestoneAction(
  code: string,
  input: { name: string; date: string },
) {
  return act(code, (actor) => addMilestone({ actor, projectId: code, input }));
}

export async function toggleMilestoneAction(code: string, milestoneId: string) {
  return act(code, (actor) =>
    toggleMilestone({ actor, projectId: code, milestoneId }),
  );
}

export async function removeMilestoneAction(code: string, milestoneId: string) {
  return act(code, (actor) =>
    removeMilestone({ actor, projectId: code, milestoneId }),
  );
}

export async function stageDeadlineAction(
  code: string,
  stage: number,
  deadline: string,
) {
  return act(code, (actor) =>
    setStageDeadline({ actor, projectId: code, stage, deadline }),
  );
}

export async function uatAction(code: string, status: UatStatus) {
  return act(code, (actor) => setUatStatus({ actor, projectId: code, status }));
}

export async function warrantyAction(
  code: string,
  input: { warrantyStart: string; warrantyEnd: string },
) {
  return act(
    code,
    (actor) => setWarranty({ actor, projectId: code, input }),
    "Garansi disimpan.",
  );
}

// ─── Penutupan ───────────────────────────────────────────────────────────

export async function submitDisbursementAction(code: string) {
  return act(
    code,
    (actor) => submitDisbursement({ actor, projectId: code }),
    "Finance Disbursement diajukan.",
  );
}

export async function verifyDisbursementAction(code: string) {
  return act(
    code,
    (actor) => verifyDisbursement({ actor, projectId: code }),
    "Dikirim ke CFO.",
  );
}

export async function decideDisbursementAction(
  code: string,
  decision: "APPROVE" | "REJECT",
  feedback?: string,
) {
  return act(code, (actor) =>
    decideDisbursement({ actor, projectId: code, decision, feedback }),
  );
}

export async function markDisbursedAction(code: string) {
  return act(
    code,
    (actor) => markDisbursed({ actor, projectId: code }),
    "Ditandai dicairkan.",
  );
}

export async function closeProjectAction(code: string) {
  return act(
    code,
    (actor) => closeProject({ actor, projectId: code }),
    "Project ditandai selesai.",
  );
}
