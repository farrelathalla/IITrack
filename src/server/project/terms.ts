import { z } from "zod";
import { isFinanceLead } from "@/lib/auth/roles";
import type { Actor } from "@/lib/auth/types";
import {
  checkTermScheme,
  checkTermTransition,
  isDownPayment,
  stageOfTerm,
  TERM_TRANSITIONS,
  type TermAction,
  type TermActor,
  type TermDraft,
} from "@/lib/finance/terms";
import {
  developersOf,
  documentOf,
  financePocOf,
  latestSubmission,
  pmOf,
} from "@/lib/project/snapshot";
import { isStageUnlocked } from "@/lib/project/stages";
import { parseDateInput } from "@/lib/time";
import { feedbackSchema, isValidLink } from "@/lib/validation";
import { recordActivity } from "@/server/activity";
import { notify, projectHref } from "@/server/notify";
import {
  ActionError,
  mutateProject,
  parseInput,
  requireStageOpen,
} from "./mutate";

const termInputSchema = z.object({
  name: z.string().trim(),
  percentage: z.coerce.number(),
  amount: z.coerce.number(),
  dueDate: z.string().trim().optional(),
  dueNote: z.string().trim().optional(),
});

export type TermInput = z.input<typeof termInputSchema>;

function toDraft(input: z.output<typeof termInputSchema>): TermDraft {
  return {
    name: input.name,
    percentage: input.percentage,
    amount: input.amount,
    dueDate: parseDateInput(input.dueDate),
    dueNote: input.dueNote ? input.dueNote : null,
  };
}

/**
 * Simpan termin pembayaran. Diisi PM saat menyusun MoU, dan setelah MoU
 * ditandatangani hanya bisa diubah CFO/VCFO (PRD bab 4.6). Termin yang alurnya
 * sudah berjalan tidak boleh dihapus maupun diubah nilainya.
 */
export async function saveTerms(params: {
  actor: Actor;
  projectId: string;
  terms: TermInput[];
}): Promise<void> {
  const drafts = parseInput(z.array(termInputSchema), params.terms).map(
    toDraft,
  );
  const check = checkTermScheme(drafts);
  if (!check.valid) throw new ActionError(check.errors.join(" "));

  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "terms.edit",
    run: async ({ tx, project, stages }) => {
      requireStageOpen(stages, 3);
      const mou = documentOf(project, "MOU");
      if (latestSubmission(project, mou?.id)?.status === "PENDING") {
        throw new ActionError(
          "MoU sedang menunggu persetujuan, jadi termin terkunci.",
        );
      }

      for (const existing of project.terms) {
        if (existing.step === "NOT_STARTED") continue;
        const draft = drafts[existing.sequence - 1];
        if (
          !draft ||
          draft.percentage !== existing.percentage ||
          draft.amount !== existing.amount
        ) {
          throw new ActionError(
            `${existing.name} sudah berjalan di alur pembayaran, jadi persentase dan nominalnya tidak bisa diubah atau dihapus.`,
          );
        }
      }

      await tx.term.deleteMany({
        where: { projectId: project.id, sequence: { gt: drafts.length } },
      });
      for (const [index, draft] of drafts.entries()) {
        const sequence = index + 1;
        await tx.term.upsert({
          where: { projectId_sequence: { projectId: project.id, sequence } },
          create: { projectId: project.id, sequence, ...draft },
          update: draft,
        });
      }

      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "terms.saved",
        summary: `Memperbarui termin pembayaran (${drafts.length} termin)`,
        stage: 3,
        division:
          project.terms.length > 0 && mou?.signedAt ? "FINANCE" : "OPERATIONAL",
        data: drafts,
      });
    },
  });
}

const ACTIVITY_TEXT: Record<TermAction, (name: string) => string> = {
  REQUEST_INVOICE: (n) => `Meminta invoice ${n}`,
  PROCESS: (n) => `Memproses invoice ${n}`,
  REJECT_INVOICE: (n) => `Menolak permintaan invoice ${n}`,
  APPROVE_INVOICE: (n) => `Menyetujui invoice ${n}`,
  MARK_SENT: (n) => `Menandai invoice ${n} dikirim ke client`,
  ADD_PROOF: (n) => `Menambahkan bukti transfer ${n}`,
  REJECT_PROOF: (n) => `Menolak bukti transfer ${n}`,
  APPROVE_PAYMENT: (n) => `Menyetujui pembayaran ${n}`,
  ISSUE_RECEIPT: (n) => `Menandai kwitansi ${n} diterbitkan`,
  COMPLETE: (n) => `Memperbarui ${n} menjadi Lunas`,
};

/** Pesan ke PM saat Finance memperbarui status termin (PRD bab 11). */
const NOTIFY_TEXT: Record<
  TermAction,
  (term: string, project: string, feedback: string) => string
> = {
  REQUEST_INVOICE: (t, p) => `${t} Project ${p} menunggu tindakan Anda.`,
  ADD_PROOF: (t, p) => `${t} Project ${p} menunggu tindakan Anda.`,
  PROCESS: (t, p) => `Invoice ${t} Project ${p} sedang diproses Finance.`,
  REJECT_INVOICE: (t, p, f) =>
    `Permintaan invoice ${t} Project ${p} ditolak: ${f}`,
  APPROVE_INVOICE: (t, p) => `Invoice ${t} Project ${p} telah disetujui.`,
  MARK_SENT: (t, p) => `Invoice ${t} Project ${p} telah dikirim ke client.`,
  REJECT_PROOF: (t, p, f) => `Bukti transfer ${t} Project ${p} ditolak: ${f}`,
  APPROVE_PAYMENT: (t, p) => `Pembayaran ${t} Project ${p} telah diterima.`,
  ISSUE_RECEIPT: (t, p) => `Kwitansi ${t} Project ${p} telah diterbitkan.`,
  COMPLETE: (t, p) => `${t} Project ${p} sudah Lunas.`,
};

const URL_FIELD: Partial<
  Record<
    TermAction,
    | "invoiceRequestUrl"
    | "approvedInvoiceUrl"
    | "transferProofUrl"
    | "receiptUrl"
  >
> = {
  REQUEST_INVOICE: "invoiceRequestUrl",
  APPROVE_INVOICE: "approvedInvoiceUrl",
  ADD_PROOF: "transferProofUrl",
  ISSUE_RECEIPT: "receiptUrl",
};

const transitionSchema = z.object({
  action: z.enum(
    Object.keys(TERM_TRANSITIONS) as [TermAction, ...TermAction[]],
  ),
  feedback: z.string().trim().optional(),
  url: z
    .string()
    .trim()
    .optional()
    .refine(
      (value) => !value || isValidLink(value),
      "Tautan harus berupa URL valid, diawali https://.",
    ),
});

/**
 * Satu langkah alur status termin (PRD bab 5.2). Pembaruan hanya berlaku bila
 * status termin masih sama dengan yang dilihat pelaku, sehingga satu termin
 * hanya punya satu alur aktif dan klik ganda tidak melompati langkah.
 */
export async function transitionTerm(params: {
  actor: Actor;
  projectId: string;
  termId: string;
  action: TermAction;
  feedback?: string;
  url?: string;
}): Promise<void> {
  const input = parseInput(transitionSchema, {
    action: params.action,
    feedback: params.feedback,
    url: params.url,
  });
  const rule = TERM_TRANSITIONS[input.action];
  if (rule.requiresFeedback) parseInput(feedbackSchema, input.feedback ?? "");

  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: ["term.pm", "term.finance"],
    run: async ({ tx, project, stages, viewer, now }) => {
      const term = project.terms.find((t) => t.id === params.termId);
      if (!term) throw new ActionError("Termin tidak ditemukan.");

      const actorRoles: TermActor[] = [];
      if (pmOf(project)?.userId === viewer.userId) actorRoles.push("PM");
      if (
        financePocOf(project)?.userId === viewer.userId ||
        isFinanceLead(viewer.role)
      ) {
        actorRoles.push("FINANCE");
      }

      const total = project.terms.length;
      const stage = stageOfTerm(term.sequence, total);
      const check = checkTermTransition({
        action: input.action,
        step: term.step,
        actorRoles,
        financePocAssigned: Boolean(financePocOf(project)),
        stageUnlocked: isStageUnlocked(stages, stage),
        feedback: input.feedback,
      });
      if (!check.allowed) throw new ActionError(check.reason);

      const urlField = URL_FIELD[input.action];
      const updated = await tx.term.updateMany({
        where: { id: term.id, step: term.step },
        data: {
          step: check.to,
          feedback: rule.requiresFeedback
            ? input.feedback
            : input.action === "REQUEST_INVOICE" || input.action === "ADD_PROOF"
              ? null
              : undefined,
          ...(urlField && input.url ? { [urlField]: input.url } : {}),
          completedAt: check.to === "DONE" ? now : undefined,
        },
      });
      if (updated.count === 0) {
        throw new ActionError(
          "Status termin ini baru saja diubah orang lain. Muat ulang halaman lalu coba lagi.",
        );
      }

      const onBehalf =
        actorRoles.includes("FINANCE") &&
        financePocOf(project)?.userId !== viewer.userId &&
        rule.actors.includes("FINANCE") &&
        !actorRoles.includes("PM");
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: `term.${input.action.toLowerCase()}`,
        summary:
          ACTIVITY_TEXT[input.action](term.name) +
          (onBehalf ? " (sebagai cadangan Finance POC)" : ""),
        stage,
        division:
          rule.actors.includes("PM") && !rule.actors.includes("FINANCE")
            ? "OPERATIONAL"
            : "FINANCE",
        result: rule.requiresFeedback
          ? "REJECTED"
          : check.to === "DONE"
            ? "APPROVED"
            : input.action === "REQUEST_INVOICE" || input.action === "ADD_PROOF"
              ? "SUBMITTED"
              : "UPDATED",
        feedback: rule.requiresFeedback ? input.feedback : null,
        objectType: "term",
        objectId: term.id,
      });

      const href = projectHref(project.code, { stage, tab: "finance" });
      if (input.action === "REQUEST_INVOICE" || input.action === "ADD_PROOF") {
        await notify(tx, {
          userIds: [financePocOf(project)?.userId],
          message: `${term.name} Project ${project.name} menunggu tindakan Anda.`,
          href,
          exceptUserId: params.actor.userId,
        });
      } else {
        await notify(tx, {
          userIds: [pmOf(project)?.userId],
          message: NOTIFY_TEXT[input.action](
            term.name,
            project.name,
            input.feedback ?? "",
          ),
          href,
          exceptUserId: params.actor.userId,
        });
      }

      if (check.to === "DONE" && isDownPayment(term.sequence)) {
        await notify(tx, {
          userIds: [
            pmOf(project)?.userId,
            ...developersOf(project).map((d) => d.userId),
          ],
          message: `DP Project ${project.name} sudah diterima. Pengembangan bisa dimulai.`,
          href: projectHref(project.code, { stage: 6, tab: "tech" }),
        });
      }
    },
  });
}
