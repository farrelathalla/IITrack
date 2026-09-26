import { z } from "zod";
import type { Actor } from "@/lib/auth/types";
import {
  developersOf,
  documentOf,
  financePocOf,
  pmOf,
} from "@/lib/project/snapshot";
import { recordActivity } from "@/server/activity";
import { notify, projectHref } from "@/server/notify";
import {
  ActionError,
  type MutationContext,
  mutateProject,
  parseInput,
  requireStageOpen,
} from "./mutate";
import { assertEligible } from "./people";

async function endAssignment(
  context: MutationContext,
  userId: string,
  role: "PM" | "DEVELOPER" | "FINANCE_POC",
) {
  await context.tx.projectAssignment.updateMany({
    where: { projectId: context.project.id, userId, role, endedAt: null },
    data: { endedAt: context.now },
  });
}

/**
 * Ganti PM (COO/VCOO). Hak edit langsung pindah ke orang baru; riwayat
 * penugasan lama tetap tersimpan, dan pengajuan yang sedang berjalan tidak
 * dibatalkan (PRD bab 2.2).
 */
export async function assignPm(params: {
  actor: Actor;
  projectId: string;
  userId: string;
}): Promise<void> {
  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "project.assignPm",
    run: async (context) => {
      const { tx, project, now } = context;
      const current = pmOf(project);
      if (current?.userId === params.userId) {
        throw new ActionError("Orang ini sudah menjadi PM project ini.");
      }
      const next = await assertEligible(tx, params.userId, "PM", now);

      if (current) await endAssignment(context, current.userId, "PM");
      await tx.projectAssignment.create({
        data: {
          projectId: project.id,
          userId: next.id,
          role: "PM",
          assignedById: params.actor.userId,
          startedAt: now,
        },
      });

      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "assignment.pm",
        summary: current
          ? `Mengganti PM dari ${current.name} ke ${next.name}`
          : `Menugaskan ${next.name} sebagai PM`,
        division: "OPERATIONAL",
        result: "UPDATED",
      });
      await notify(tx, {
        userIds: [next.id],
        message: `Anda ditugaskan ke Project ${project.code}.`,
        href: projectHref(project.code, { tab: "pm" }),
      });
    },
  });
}

const developersSchema = z
  .array(
    z.object({
      userId: z.string().min(1),
      techRole: z.string().trim().min(1, "Role teknis wajib diisi."),
    }),
  )
  .min(1, "Pilih minimal satu developer.");

/**
 * Tugaskan Developer (CTO/VCTO), sebagai jawaban atas Request SDM. Bisa satu
 * atau lebih orang, dan bisa ditambah kapan saja setelah Stage 4 terbuka.
 */
export async function assignDevelopers(params: {
  actor: Actor;
  projectId: string;
  developers: { userId: string; techRole: string }[];
}): Promise<void> {
  const developers = parseInput(developersSchema, params.developers);

  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "developer.assign",
    run: async (context) => {
      const { tx, project, now, stages } = context;
      requireStageOpen(stages, 4);
      if (!project.staffing) {
        throw new ActionError(
          "PM belum mengirim Request SDM. Developer ditugaskan sebagai jawaban atas Request SDM.",
        );
      }

      const existing = new Set(developersOf(project).map((d) => d.userId));
      const names: string[] = [];
      for (const developer of developers) {
        if (existing.has(developer.userId)) {
          throw new ActionError(
            "Developer ini sudah ditugaskan di project ini.",
          );
        }
        const user = await assertEligible(
          tx,
          developer.userId,
          "DEVELOPER",
          now,
        );
        await tx.projectAssignment.create({
          data: {
            projectId: project.id,
            userId: user.id,
            role: "DEVELOPER",
            techRole: developer.techRole,
            assignedById: params.actor.userId,
            startedAt: now,
          },
        });
        existing.add(user.id);
        names.push(user.name);
      }

      if (project.staffing.status !== "DEVELOPER_ASSIGNED") {
        await tx.staffingRequest.update({
          where: { projectId: project.id },
          data: {
            status: "DEVELOPER_ASSIGNED",
            assignedById: params.actor.userId,
            assignedAt: now,
          },
        });
      }

      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "assignment.developer",
        summary: `Menugaskan developer: ${names.join(", ")}`,
        stage: 4,
        division: "TECHDEV",
        result: "APPROVED",
      });
      await notify(tx, {
        userIds: developers.map((d) => d.userId),
        message: `Anda ditugaskan sebagai developer di Project ${project.name}.`,
        href: projectHref(project.code, { stage: 4, tab: "tech" }),
      });
      await notify(tx, {
        userIds: [pmOf(project)?.userId],
        message: `Developer untuk Project ${project.name} sudah ditugaskan: ${names.join(", ")}.`,
        href: projectHref(project.code, { stage: 4, tab: "tech" }),
      });
    },
  });
}

/** Ganti Developer (CTO/VCTO). Kontrak developer lama tetap tersimpan. */
export async function replaceDeveloper(params: {
  actor: Actor;
  projectId: string;
  previousUserId: string;
  userId: string;
  techRole: string;
}): Promise<void> {
  const techRole = parseInput(
    z.string().trim().min(1, "Role teknis wajib diisi."),
    params.techRole,
  );

  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "developer.assign",
    run: async (context) => {
      const { tx, project, now } = context;
      const previous = developersOf(project).find(
        (d) => d.userId === params.previousUserId,
      );
      if (!previous) {
        throw new ActionError("Developer yang akan diganti tidak ditemukan.");
      }
      if (developersOf(project).some((d) => d.userId === params.userId)) {
        throw new ActionError(
          "Developer pengganti sudah ditugaskan di project ini.",
        );
      }
      const next = await assertEligible(tx, params.userId, "DEVELOPER", now);

      await endAssignment(context, previous.userId, "DEVELOPER");
      await tx.projectAssignment.create({
        data: {
          projectId: project.id,
          userId: next.id,
          role: "DEVELOPER",
          techRole,
          assignedById: params.actor.userId,
          startedAt: now,
        },
      });

      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "assignment.developer_replaced",
        summary: `Mengganti developer ${previous.name} dengan ${next.name}`,
        stage: 4,
        division: "TECHDEV",
      });
      await notify(tx, {
        userIds: [next.id],
        message: `Anda ditugaskan sebagai developer di Project ${project.name}.`,
        href: projectHref(project.code, { tab: "tech" }),
      });
      await notify(tx, {
        userIds: [pmOf(project)?.userId],
        message: `Developer ${previous.name} di Project ${project.name} diganti ${next.name}. Siapkan Kontrak Programmer untuknya.`,
        href: projectHref(project.code, { stage: 4, tab: "tech" }),
      });
    },
  });
}

/**
 * Tunjuk atau Ganti Finance POC (CFO/VCFO), setelah MoU ditandatangani
 * (PRD bab 5.1).
 */
export async function assignFinancePoc(params: {
  actor: Actor;
  projectId: string;
  userId: string;
}): Promise<void> {
  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "financePoc.assign",
    run: async (context) => {
      const { tx, project, now } = context;
      if (!documentOf(project, "MOU")?.signedAt) {
        throw new ActionError(
          "Finance POC ditunjuk setelah MoU ditandatangani.",
        );
      }
      const current = financePocOf(project);
      if (current?.userId === params.userId) {
        throw new ActionError(
          "Orang ini sudah menjadi Finance POC project ini.",
        );
      }
      const next = await assertEligible(tx, params.userId, "FINANCE_POC", now);

      if (current) await endAssignment(context, current.userId, "FINANCE_POC");
      await tx.projectAssignment.create({
        data: {
          projectId: project.id,
          userId: next.id,
          role: "FINANCE_POC",
          assignedById: params.actor.userId,
          startedAt: now,
        },
      });

      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "assignment.finance_poc",
        summary: current
          ? `Mengganti Finance POC dari ${current.name} ke ${next.name}`
          : `Menunjuk ${next.name} sebagai Finance POC`,
        division: "FINANCE",
      });
      await notify(tx, {
        userIds: [next.id],
        message: `Anda ditunjuk sebagai Finance POC Project ${project.name}.`,
        href: projectHref(project.code, { tab: "finance" }),
      });
      await notify(tx, {
        userIds: [pmOf(project)?.userId],
        message: `${next.name} ditunjuk sebagai Finance POC Project ${project.name}.`,
        href: projectHref(project.code, { tab: "finance" }),
      });
    },
  });
}
