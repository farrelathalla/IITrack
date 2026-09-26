import { z } from "zod";
import type { Actor } from "@/lib/auth/types";
import {
  isStageNumber,
  stageDefinition,
  UAT_STATUS_LABELS,
  type UatStatus,
} from "@/lib/project/catalog";
import {
  disbursementReadiness,
  FINAL_STATUS_LABELS,
  finalStatusFor,
  isReadyToClose,
} from "@/lib/project/closure";
import { documentOf, financePocOf, pmOf } from "@/lib/project/snapshot";
import { formatDate, parseDateInput } from "@/lib/time";
import { feedbackSchema } from "@/lib/validation";
import { recordActivity } from "@/server/activity";
import { notify, notifyRoles, projectHref } from "@/server/notify";
import { getSettings } from "@/server/settings";
import {
  ActionError,
  mutateProject,
  parseInput,
  requireStageOpen,
} from "./mutate";

function requiredDate(label: string) {
  return z
    .string()
    .trim()
    .min(1, `${label} wajib diisi.`)
    .transform((value, ctx) => {
      const date = parseDateInput(value);
      if (!date) {
        ctx.addIssue({ code: "custom", message: `${label} tidak valid.` });
        return z.NEVER;
      }
      return date;
    });
}

// ─── Stage 6: Latest Update dan pengembangan selesai ──────────────────────

export async function updateLatestUpdate(params: {
  actor: Actor;
  projectId: string;
  text: string;
}): Promise<void> {
  const text = parseInput(
    z.string().trim().min(1, "Latest update wajib diisi."),
    params.text,
  );
  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "ops.edit",
    run: async ({ tx, project, stages, now }) => {
      requireStageOpen(stages, 6);
      await tx.techInfo.upsert({
        where: { projectId: project.id },
        create: {
          projectId: project.id,
          latestUpdate: text,
          latestUpdateAt: now,
        },
        update: { latestUpdate: text, latestUpdateAt: now },
      });
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "ops.latest_update",
        summary: "Memperbarui Latest Update",
        stage: 6,
        division: "OPERATIONAL",
      });
    },
  });
}

/** Tandai Pengembangan Selesai (PRD bab 4.9). Membuka Stage 7. */
export async function markDevelopmentDone(params: {
  actor: Actor;
  projectId: string;
}): Promise<void> {
  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "ops.edit",
    run: async ({ tx, project, stages, now }) => {
      requireStageOpen(stages, 6);
      if (project.developmentDoneAt) {
        throw new ActionError("Pengembangan sudah ditandai selesai.");
      }
      await tx.project.update({
        where: { id: project.id },
        data: { developmentDoneAt: now },
      });
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "ops.development_done",
        summary: "Menandai pengembangan selesai",
        stage: 6,
        division: "OPERATIONAL",
        result: "APPROVED",
      });
    },
  });
}

// ─── Client-Facing Milestones ─────────────────────────────────────────────

const milestoneSchema = z.object({
  name: z.string().trim().min(1, "Nama milestone wajib diisi."),
  date: requiredDate("Tanggal milestone"),
});

export async function addMilestone(params: {
  actor: Actor;
  projectId: string;
  input: z.input<typeof milestoneSchema>;
}): Promise<void> {
  const input = parseInput(milestoneSchema, params.input);
  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "ops.edit",
    run: async ({ tx, project }) => {
      await tx.milestone.create({
        data: { projectId: project.id, name: input.name, date: input.date },
      });
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "milestone.added",
        summary: `Menambahkan milestone ${input.name} (${formatDate(input.date)})`,
        division: "OPERATIONAL",
        result: "CREATED",
      });
    },
  });
}

export async function toggleMilestone(params: {
  actor: Actor;
  projectId: string;
  milestoneId: string;
}): Promise<void> {
  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "ops.edit",
    run: async ({ tx, project, now }) => {
      const milestone = project.milestones.find(
        (m) => m.id === params.milestoneId,
      );
      if (!milestone) throw new ActionError("Milestone tidak ditemukan.");
      await tx.milestone.update({
        where: { id: milestone.id },
        data: { doneAt: milestone.doneAt ? null : now },
      });
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "milestone.toggled",
        summary: milestone.doneAt
          ? `Membuka kembali milestone ${milestone.name}`
          : `Menandai milestone ${milestone.name} selesai`,
        division: "OPERATIONAL",
      });
    },
  });
}

export async function removeMilestone(params: {
  actor: Actor;
  projectId: string;
  milestoneId: string;
}): Promise<void> {
  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "ops.edit",
    run: async ({ tx, project }) => {
      const milestone = project.milestones.find(
        (m) => m.id === params.milestoneId,
      );
      if (!milestone) throw new ActionError("Milestone tidak ditemukan.");
      await tx.milestone.delete({ where: { id: milestone.id } });
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "milestone.removed",
        summary: `Menghapus milestone ${milestone.name}`,
        division: "OPERATIONAL",
      });
    },
  });
}

// ─── Tenggat stage ────────────────────────────────────────────────────────

export async function setStageDeadline(params: {
  actor: Actor;
  projectId: string;
  stage: number;
  deadline: string;
}): Promise<void> {
  if (!isStageNumber(params.stage))
    throw new ActionError("Stage tidak dikenal.");
  const deadline = params.deadline ? parseDateInput(params.deadline) : null;
  if (params.deadline && !deadline)
    throw new ActionError("Tanggal tidak valid.");
  const def = stageDefinition(params.stage);

  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "ops.edit",
    run: async ({ tx, project }) => {
      await tx.projectStage.upsert({
        where: { projectId_stage: { projectId: project.id, stage: def.n } },
        create: { projectId: project.id, stage: def.n, deadline },
        update: { deadline },
      });
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "stage.deadline",
        summary: deadline
          ? `Mengatur deadline Stage ${def.n} menjadi ${formatDate(deadline)}`
          : `Menghapus deadline Stage ${def.n}`,
        stage: def.n,
      });
    },
  });
}

// ─── Stage 7: UAT dan garansi ─────────────────────────────────────────────

export async function setUatStatus(params: {
  actor: Actor;
  projectId: string;
  status: UatStatus;
}): Promise<void> {
  if (!(params.status in UAT_STATUS_LABELS))
    throw new ActionError("Status UAT tidak dikenal.");
  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "ops.edit",
    run: async ({ tx, project, stages }) => {
      requireStageOpen(stages, 7);
      await tx.handover.upsert({
        where: { projectId: project.id },
        create: { projectId: project.id, uatStatus: params.status },
        update: { uatStatus: params.status },
      });
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "handover.uat",
        summary: `Mengubah status UAT menjadi ${UAT_STATUS_LABELS[params.status]}`,
        stage: 7,
        division: "OPERATIONAL",
      });
    },
  });
}

const warrantySchema = z
  .object({
    warrantyStart: requiredDate("Mulai garansi"),
    warrantyEnd: requiredDate("Akhir garansi"),
  })
  .refine((v) => v.warrantyEnd >= v.warrantyStart, {
    path: ["warrantyEnd"],
    message: "Akhir garansi harus setelah mulai garansi.",
  });

export async function setWarranty(params: {
  actor: Actor;
  projectId: string;
  input: z.input<typeof warrantySchema>;
}): Promise<void> {
  const input = parseInput(warrantySchema, params.input);
  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "ops.edit",
    run: async ({ tx, project, stages }) => {
      requireStageOpen(stages, 7);
      if (!documentOf(project, "BAST")?.signedAt) {
        throw new ActionError(
          "Isi garansi setelah BAST ditandai ditandatangani.",
        );
      }
      await tx.handover.upsert({
        where: { projectId: project.id },
        create: { projectId: project.id, ...input },
        update: input,
      });
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "handover.warranty",
        summary: `Mengatur garansi ${formatDate(input.warrantyStart)} s.d. ${formatDate(input.warrantyEnd)}`,
        stage: 7,
        division: "OPERATIONAL",
      });
    },
  });
}

// ─── Stage 9: Finance Disbursement ────────────────────────────────────────

export async function submitDisbursement(params: {
  actor: Actor;
  projectId: string;
}): Promise<void> {
  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "disbursement.submit",
    run: async ({ tx, project, stages, now }) => {
      requireStageOpen(stages, 9);
      const readiness = disbursementReadiness(project, now);
      if (!readiness.ready) {
        throw new ActionError(
          `Finance Disbursement belum bisa diajukan. Yang belum terpenuhi: ${readiness.missing.join(", ")}.`,
        );
      }
      if (project.disbursement && project.disbursement.status !== "REJECTED") {
        throw new ActionError("Finance Disbursement sudah diajukan.");
      }
      const data = {
        status: "SUBMITTED" as const,
        feedback: null,
        submittedById: params.actor.userId,
        submittedAt: now,
        verifiedById: null,
        verifiedAt: null,
        decidedById: null,
        decidedAt: null,
      };
      await tx.disbursement.upsert({
        where: { projectId: project.id },
        create: { projectId: project.id, ...data },
        update: data,
      });
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "disbursement.submitted",
        summary: project.disbursement
          ? "Mengajukan ulang Finance Disbursement"
          : "Mengajukan Finance Disbursement",
        stage: 9,
        division: "FINANCE",
        result: "SUBMITTED",
      });
      await notify(tx, {
        userIds: [financePocOf(project)?.userId],
        message: `Finance Disbursement Project ${project.name} menunggu verifikasi Anda.`,
        href: projectHref(project.code, { stage: 9, tab: "finance" }),
      });
    },
  });
}

/** Finance POC memverifikasi lalu Kirim ke CFO (PRD bab 5.5). */
export async function verifyDisbursement(params: {
  actor: Actor;
  projectId: string;
}): Promise<void> {
  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "disbursement.finance",
    run: async ({ tx, project, now }) => {
      const updated = await tx.disbursement.updateMany({
        where: { projectId: project.id, status: "SUBMITTED" },
        data: {
          status: "VERIFIED",
          verifiedById: params.actor.userId,
          verifiedAt: now,
        },
      });
      if (updated.count === 0) {
        throw new ActionError(
          "Tidak ada Finance Disbursement yang menunggu verifikasi.",
        );
      }
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "disbursement.verified",
        summary: "Memverifikasi Finance Disbursement dan mengirim ke CFO",
        stage: 9,
        division: "FINANCE",
        result: "SUBMITTED",
      });
      await notifyRoles(tx, ["CFO", "VICE_CFO"], {
        message: `Finance Disbursement Project ${project.name} menunggu persetujuan Anda.`,
        href: projectHref(project.code, { stage: 9, tab: "finance" }),
      });
    },
  });
}

const disbursementDecisionSchema = z.discriminatedUnion("decision", [
  z.object({ decision: z.literal("APPROVE") }),
  z.object({ decision: z.literal("REJECT"), feedback: feedbackSchema }),
]);

export async function decideDisbursement(params: {
  actor: Actor;
  projectId: string;
  decision: "APPROVE" | "REJECT";
  feedback?: string;
}): Promise<void> {
  const input = parseInput(disbursementDecisionSchema, {
    decision: params.decision,
    feedback: params.feedback,
  });
  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "disbursement.decide",
    run: async ({ tx, project, now }) => {
      const approved = input.decision === "APPROVE";
      const updated = await tx.disbursement.updateMany({
        where: { projectId: project.id, status: "VERIFIED" },
        data: {
          status: approved ? "APPROVED" : "REJECTED",
          decidedById: params.actor.userId,
          decidedAt: now,
          feedback: approved ? null : input.feedback,
        },
      });
      if (updated.count === 0) {
        throw new ActionError(
          "Finance Disbursement ini belum diverifikasi Finance POC atau sudah diputuskan.",
        );
      }
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: approved ? "disbursement.approved" : "disbursement.rejected",
        summary: approved
          ? "Menyetujui Finance Disbursement"
          : "Menolak Finance Disbursement",
        stage: 9,
        division: "FINANCE",
        result: approved ? "APPROVED" : "REJECTED",
        feedback: approved ? null : input.feedback,
      });
      await notify(tx, {
        userIds: [pmOf(project)?.userId, financePocOf(project)?.userId],
        message: `Finance Disbursement Project ${project.name} ${approved ? "disetujui" : "ditolak"}.`,
        href: projectHref(project.code, { stage: 9, tab: "finance" }),
      });
    },
  });
}

export async function markDisbursed(params: {
  actor: Actor;
  projectId: string;
}): Promise<void> {
  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "disbursement.finance",
    run: async ({ tx, project, now }) => {
      const updated = await tx.disbursement.updateMany({
        where: { projectId: project.id, status: "APPROVED" },
        data: {
          status: "DISBURSED",
          disbursedById: params.actor.userId,
          disbursedAt: now,
        },
      });
      if (updated.count === 0) {
        throw new ActionError("Finance Disbursement belum disetujui CFO/VCFO.");
      }
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "disbursement.disbursed",
        summary: "Menandai Finance Disbursement dicairkan",
        stage: 9,
        division: "FINANCE",
        result: "APPROVED",
      });
      await notify(tx, {
        userIds: [pmOf(project)?.userId],
        message: `Dana Project ${project.name} sudah dicairkan. Project siap ditutup.`,
        href: projectHref(project.code, { stage: 9, tab: "pm" }),
      });
    },
  });
}

// ─── Penutupan project ────────────────────────────────────────────────────

/**
 * Tandai Project Sebagai Selesai (PM atau COO/VCOO). Hanya bila seluruh item
 * Closure Checklist terpenuhi; Status Final dihitung otomatis (PRD bab 4.12).
 */
export async function closeProject(params: {
  actor: Actor;
  projectId: string;
}): Promise<void> {
  const settings = await getSettings();
  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "project.close",
    run: async ({ tx, project, stages, now }) => {
      requireStageOpen(stages, 9);
      if (!isReadyToClose(project, now)) {
        throw new ActionError(
          "Belum semua syarat terpenuhi. Selesaikan semua item di Closure Checklist sebelum menutup project.",
        );
      }
      const finalStatus = finalStatusFor(
        now,
        project.targetEnd,
        settings.finalStatusToleranceDays,
      );
      const updated = await tx.project.updateMany({
        where: { id: project.id, closedAt: null },
        data: { closedAt: now, finalStatus },
      });
      if (updated.count === 0) throw new ActionError("Project sudah ditutup.");

      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "project.closed",
        summary: `Menandai project selesai (${FINAL_STATUS_LABELS[finalStatus]})`,
        stage: 9,
        division: "OPERATIONAL",
        result: "APPROVED",
      });
      await notifyRoles(tx, ["COO", "VICE_COO"], {
        message: `Project ${project.name} telah ditutup.`,
        href: projectHref(project.code),
        exceptUserId: params.actor.userId,
      });
      await notify(tx, {
        userIds: [pmOf(project)?.userId],
        message: `Project ${project.name} telah ditutup.`,
        href: projectHref(project.code),
        exceptUserId: params.actor.userId,
      });
    },
  });
}
