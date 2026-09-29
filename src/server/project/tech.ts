import { z } from "zod";
import type { Actor } from "@/lib/auth/types";
import { parseDateInput } from "@/lib/time";
import { isValidLink } from "@/lib/validation";
import { recordActivity } from "@/server/activity";
import { notifyRoles, projectHref } from "@/server/notify";
import {
  ActionError,
  mutateProject,
  parseInput,
  requireStageOpen,
} from "./mutate";

const staffingSchema = z.object({
  technicalNeeds: z.string().trim().min(1, "Kebutuhan teknis wajib diisi."),
  roleRequested: z.string().trim().min(1, "Role yang diminta wajib diisi."),
  headcount: z.coerce
    .number()
    .int("Jumlah orang harus bilangan bulat.")
    .min(1, "Jumlah orang minimal 1."),
  neededBy: z
    .string()
    .trim()
    .min(1, "Tanggal dibutuhkan wajib diisi.")
    .transform((value, ctx) => {
      const date = parseDateInput(value);
      if (!date) {
        ctx.addIssue({
          code: "custom",
          message: "Tanggal dibutuhkan tidak valid.",
        });
        return z.NEVER;
      }
      return date;
    }),
});

export type StaffingInput = z.input<typeof staffingSchema>;

/** Kirim Request SDM (PRD bab 4.7). Bisa diperbarui selama belum dijawab. */
export async function submitStaffing(params: {
  actor: Actor;
  projectId: string;
  input: StaffingInput;
}): Promise<void> {
  const input = parseInput(staffingSchema, params.input);

  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "staffing.submit",
    run: async ({ tx, project, stages, now }) => {
      requireStageOpen(stages, 4);
      if (project.staffing?.status === "DEVELOPER_ASSIGNED") {
        throw new ActionError(
          "Request SDM sudah dijawab dengan penugasan developer. Minta CTO/VCTO bila butuh developer tambahan.",
        );
      }
      await tx.staffingRequest.upsert({
        where: { projectId: project.id },
        create: {
          projectId: project.id,
          ...input,
          submittedById: params.actor.userId,
          submittedAt: now,
        },
        update: { ...input, submittedAt: now },
      });
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "staffing.submitted",
        summary: project.staffing
          ? "Memperbarui Request SDM"
          : `Mengirim Request SDM: ${input.roleRequested} (${input.headcount} orang)`,
        stage: 4,
        division: "TECHDEV",
        result: "SUBMITTED",
      });
      if (!project.staffing) {
        await notifyRoles(tx, ["CTO", "VICE_CTO"], {
          message: `Request SDM baru untuk Project ${project.name}.`,
          href: projectHref(project.code, { stage: 4, tab: "tech" }),
        });
      }
    },
  });
}

const optionalLink = z
  .string()
  .trim()
  .optional()
  .refine(
    (value) => !value || isValidLink(value),
    "Tautan harus berupa URL valid, diawali https://.",
  )
  .transform((value) => (value === undefined ? undefined : value || null));

const optionalText = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value === undefined ? undefined : value || null));

const techInfoSchema = z.object({
  githubRepo: optionalLink,
  sprintPlanning: optionalLink,
  currentSprint: optionalText,
  nextMilestone: optionalText,
  progressPercent: z
    .string()
    .trim()
    .optional()
    .transform((value, ctx) => {
      if (value === undefined) return undefined;
      if (value === "") return null;
      const n = Number(value);
      if (!Number.isInteger(n) || n < 0 || n > 100) {
        ctx.addIssue({
          code: "custom",
          message: "Progres harus angka 0 sampai 100.",
        });
        return z.NEVER;
      }
      return n;
    }),
});

export type TechInfoInput = z.input<typeof techInfoSchema>;

const TECH_LABELS: Record<string, string> = {
  githubRepo: "GitHub Repository",
  sprintPlanning: "Sprint Planning",
  currentSprint: "Sprint Saat Ini",
  nextMilestone: "Next Milestone",
  progressPercent: "Progress",
};

/**
 * Repository, sprint, dan progres (developer yang ditugaskan atau CTO/VCTO).
 * Kode tetap di GitHub; IITrack hanya menyimpan tautannya.
 */
export async function updateTechInfo(params: {
  actor: Actor;
  projectId: string;
  input: TechInfoInput;
}): Promise<void> {
  const input = parseInput(techInfoSchema, params.input);
  const changed = Object.fromEntries(
    Object.entries(input).filter(([, value]) => value !== undefined),
  );
  if (Object.keys(changed).length === 0) return;

  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "tech.edit",
    run: async ({ tx, project, stages }) => {
      requireStageOpen(stages, 4);
      await tx.techInfo.upsert({
        where: { projectId: project.id },
        create: { projectId: project.id, ...changed },
        update: changed,
      });
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "tech.updated",
        summary: `Memperbarui ${Object.keys(changed)
          .map((k) => TECH_LABELS[k])
          .join(", ")}`,
        stage: 6,
        division: "TECHDEV",
        data: changed,
      });
    },
  });
}

export async function addBlocker(params: {
  actor: Actor;
  projectId: string;
  description: string;
}): Promise<void> {
  const description = parseInput(
    z.string().trim().min(1, "Deskripsi blocker wajib diisi."),
    params.description,
  );
  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "tech.edit",
    run: async ({ tx, project, stages }) => {
      // Sama dengan Update Progress: hambatan teknis bisa muncul sejak
      // developer ditugaskan, tidak perlu menunggu Stage 6.
      requireStageOpen(stages, 4);
      await tx.techBlocker.create({
        data: {
          projectId: project.id,
          description,
          createdById: params.actor.userId,
        },
      });
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "tech.blocker_added",
        summary: `Menambahkan technical blocker: ${description}`,
        stage: 6,
        division: "TECHDEV",
      });
    },
  });
}

export async function resolveBlocker(params: {
  actor: Actor;
  projectId: string;
  blockerId: string;
}): Promise<void> {
  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "tech.edit",
    run: async ({ tx, project, now }) => {
      const blocker = project.blockers.find((b) => b.id === params.blockerId);
      if (!blocker) throw new ActionError("Blocker tidak ditemukan.");
      if (blocker.resolvedAt)
        throw new ActionError("Blocker ini sudah diselesaikan.");
      await tx.techBlocker.update({
        where: { id: blocker.id },
        data: { resolvedAt: now },
      });
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "tech.blocker_resolved",
        summary: `Menyelesaikan technical blocker: ${blocker.description}`,
        stage: 6,
        division: "TECHDEV",
        result: "APPROVED",
      });
    },
  });
}
