import {
  type ApprovalKind,
  canEditTab,
  canManageApprover,
  canOnProject,
  canSeeAmounts,
  canSeeContractLink,
  canSeeMouLink,
  type DivisionTab,
  type ProjectAction,
  type Viewer,
} from "@/lib/auth/access";
import { isFinanceLead } from "@/lib/auth/roles";
import type { RoleName } from "@/lib/auth/types";
import {
  type ChecklistItem,
  closureChecklist,
  disbursementReadiness,
} from "@/lib/project/closure";
import type { ProjectSnapshot } from "@/lib/project/snapshot";
import {
  deriveStages,
  newlyCompletedStages,
  type StageRequirement,
  type StageState,
  stageRequirements,
} from "@/lib/project/stages";
import { type ProjectSummary, summarize } from "@/lib/project/status";
import { prisma } from "@/server/db";
import { loadApproverRules } from "@/server/settings";
import { accessOf, loadSnapshot, syncStageCompletion } from "./snapshot";

const ACTIONS: ProjectAction[] = [
  "project.assignPm",
  "project.edit",
  "project.delete",
  "project.close",
  "stage1.edit",
  "charter.edit",
  "charter.decide",
  "mou.edit",
  "mou.decide",
  "terms.edit",
  "staffing.submit",
  "developer.assign",
  "contract.edit",
  "contract.decide",
  "tech.edit",
  "financePoc.assign",
  "term.pm",
  "term.finance",
  "ops.edit",
  "disbursement.submit",
  "disbursement.finance",
  "disbursement.decide",
];

export type Permissions = Record<ProjectAction, boolean>;

export interface ProjectView {
  project: ProjectSnapshot;
  stages: StageState[];
  summary: ProjectSummary;
  can: Permissions;
  editableTabs: Record<DivisionTab, boolean>;
  viewer: { userId: string; role: RoleName | null };
  /** Nominal disembunyikan untuk pengguna ini (PRD bab 2.4). */
  amountsHidden: boolean;
  /** Pelaku bertindak di tab Finance sebagai cadangan Finance POC. */
  financeBackup: boolean;
  checklist: ChecklistItem[];
  disbursementMissing: string[];
  /** Dokumen yang tautannya ada tetapi disembunyikan dari pengguna ini. */
  hiddenDocumentIds: string[];
  /** Syarat selesai tiap stage, untuk checklist di panel stage. */
  requirements: Record<number, StageRequirement[]>;
  /** Nama approver yang dipilih di Workflow & Approver, bila ada. */
  approverNames: Partial<Record<ApprovalKind, string>>;
  /** Jenis pengajuan yang approvernya boleh diatur pengguna ini. */
  manageableApprovers: ApprovalKind[];
}

/**
 * Menyiapkan data Project Detail untuk satu pengguna. Nominal keuangan dan
 * tautan yang tidak boleh ia lihat dihapus di sini, sebelum dikirim ke
 * peramban, bukan sekadar disembunyikan di tampilan (PRD bab 13).
 */
export async function loadProjectView(
  code: string,
  viewer: Viewer,
  now: Date = new Date(),
): Promise<ProjectView | null> {
  let project = await loadSnapshot(code);
  if (!project) return null;

  // Stage yang selesai karena waktu (misalnya garansi berakhir) dicatat saat
  // project dibuka, supaya stage berikutnya terbuka tanpa menunggu aksi lain.
  if (
    !project.closedAt &&
    newlyCompletedStages(project, deriveStages(project, now)).length > 0
  ) {
    const id = project.id;
    await prisma.$transaction(async (tx) => {
      const fresh = await loadSnapshot(id, tx);
      if (fresh) await syncStageCompletion(tx, fresh, null, now);
    });
    project = (await loadSnapshot(code)) ?? project;
  }

  const approvers = await loadApproverRules(prisma, now);
  const access = { ...accessOf(project), approvers };
  const stages = deriveStages(project, now);
  const summary = summarize(project, stages, now);
  const can = Object.fromEntries(
    ACTIONS.map((action) => [
      action,
      canOnProject(viewer, action, access).allowed,
    ]),
  ) as Permissions;

  const showAmounts = canSeeAmounts(viewer, access);
  const showMou = canSeeMouLink(viewer, access);
  const readiness = disbursementReadiness(project, now);

  const hiddenDocumentIds: string[] = [];
  const sanitized: ProjectSnapshot = {
    ...project,
    terms: showAmounts
      ? project.terms
      : project.terms.map((t) => ({
          ...t,
          amount: 0,
          invoiceRequestUrl: null,
          approvedInvoiceUrl: null,
          transferProofUrl: null,
          receiptUrl: null,
        })),
    documents: project.documents.map((doc) => {
      const hidden =
        (doc.kind === "MOU" && !showMou) ||
        (doc.kind === "PROGRAMMER_CONTRACT" &&
          !canSeeContractLink(viewer, access, doc.developerId));
      if (!hidden) return doc;
      if (doc.url) hiddenDocumentIds.push(doc.id);
      return { ...doc, url: null };
    }),
  };

  return {
    project: sanitized,
    stages,
    summary,
    can,
    editableTabs: {
      pm: canEditTab(viewer, access, "pm"),
      tech: canEditTab(viewer, access, "tech"),
      finance: canEditTab(viewer, access, "finance"),
    },
    viewer: { userId: viewer.userId, role: viewer.role },
    amountsHidden: !showAmounts,
    financeBackup:
      isFinanceLead(viewer.role) && access.financePocUserId !== viewer.userId,
    checklist: closureChecklist(project, now),
    disbursementMissing: readiness.ready ? [] : readiness.missing,
    hiddenDocumentIds,
    requirements: Object.fromEntries(
      stages.map((s) => [s.n, stageRequirements(project, s.n, now)]),
    ),
    approverNames: Object.fromEntries(
      Object.entries(approvers).map(([kind, rule]) => [kind, rule.names]),
    ),
    manageableApprovers: (
      [
        "PROJECT_CHARTER",
        "MOU",
        "PROGRAMMER_CONTRACT",
        "INVOICE",
        "DISBURSEMENT",
      ] as const
    ).filter((kind) => canManageApprover(viewer.role, kind)),
  };
}
