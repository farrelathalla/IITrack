import { z } from "zod";
import { canGlobally } from "@/lib/auth/access";
import type { Actor } from "@/lib/auth/types";
import {
  PROJECT_SOURCE_LABELS,
  PROJECT_TYPE_LABELS,
} from "@/lib/project/catalog";
import { formatProjectId } from "@/lib/project/project-id";
import { parseDateInput } from "@/lib/time";
import { recordActivity } from "@/server/activity";
import { viewerOf } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { notify, projectHref } from "@/server/notify";
import { ActionError, parseInput } from "./mutate";
import { assertEligible } from "./people";

const dateField = (label: string) =>
  z
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

const optionalEnum = <T extends Record<string, string>>(values: T) =>
  z
    .string()
    .optional()
    .transform((value) => (value ? value : null))
    .refine(
      (value) => value === null || value in values,
      "Pilihan tidak dikenal.",
    )
    .transform((value) => value as keyof T | null);

/** Detail awal project, dipakai form Tambah Project dan Edit Detail. */
export const projectDetailFields = {
  name: z.string().trim().min(1, "Nama project wajib diisi."),
  client: z.string().trim().min(1, "Client wajib diisi."),
  type: optionalEnum(PROJECT_TYPE_LABELS),
  source: optionalEnum(PROJECT_SOURCE_LABELS),
  targetStart: dateField("Target mulai"),
  targetEnd: dateField("Target selesai"),
  internalNote: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value : null)),
};

export const targetOrder = {
  check: (data: { targetStart: Date; targetEnd: Date }) =>
    data.targetEnd >= data.targetStart,
  params: {
    path: ["targetEnd"],
    message: "Target selesai harus setelah target mulai.",
  },
};

export const createProjectSchema = z
  .object({
    ...projectDetailFields,
    pmUserId: z.string().trim().min(1, "Project Manager wajib dipilih."),
  })
  .refine(targetOrder.check, targetOrder.params);

export type CreateProjectInput = z.input<typeof createProjectSchema>;

/** Periode kepengurusan yang sedang berjalan, sumber kode Project ID. */
export async function currentPeriod(now: Date = new Date()) {
  return prisma.period.findFirst({
    where: { startDate: { lte: now }, endDate: { gt: now } },
    orderBy: { startDate: "desc" },
  });
}

/** Pratinjau Project ID berikutnya di form Tambah Project (PRD bab 8.5). */
export async function previewNextProjectId(
  now: Date = new Date(),
): Promise<string | null> {
  const period = await currentPeriod(now);
  if (!period) return null;
  const counter = await prisma.projectNumberCounter.findUnique({
    where: { periodCode: period.code },
  });
  return formatProjectId(period.code, (counter?.highestIssued ?? 0) + 1);
}

/**
 * Membuat project: menerbitkan Project ID, menugaskan PM, membuka Stage 1,
 * dan memberi tahu PM (PRD bab 8.5). Nomor diterbitkan di transaksi yang sama,
 * sehingga isian yang gagal tidak menghabiskan nomor.
 */
export async function createProject(params: {
  actor: Actor;
  input: CreateProjectInput;
  now?: Date;
}): Promise<{ code: string; pmName: string }> {
  const now = params.now ?? new Date();
  const viewer = viewerOf(params.actor, now);
  const decision = canGlobally(viewer, "project.create");
  if (!decision.allowed) throw new ActionError(decision.reason);

  const data = parseInput(createProjectSchema, params.input);

  const period = await currentPeriod(now);
  if (!period) {
    throw new ActionError(
      "Belum ada periode kepengurusan aktif. Minta Super Admin membuat periode di Pengaturan > System.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const pm = await assertEligible(tx, data.pmUserId, "PM", now);

    const counter = await tx.projectNumberCounter.upsert({
      where: { periodCode: period.code },
      create: { periodCode: period.code, highestIssued: 1 },
      update: { highestIssued: { increment: 1 } },
    });
    const code = formatProjectId(period.code, counter.highestIssued);

    const project = await tx.project.create({
      data: {
        code,
        periodCode: period.code,
        sequence: counter.highestIssued,
        name: data.name,
        client: data.client,
        type: data.type,
        source: data.source,
        targetStart: data.targetStart,
        targetEnd: data.targetEnd,
        internalNote: data.internalNote,
        createdById: params.actor.userId,
        stages: {
          create: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((stage) => ({ stage })),
        },
        assignments: {
          create: {
            userId: pm.id,
            role: "PM",
            assignedById: params.actor.userId,
            startedAt: now,
          },
        },
      },
    });

    await recordActivity(tx, {
      projectId: project.id,
      actorId: params.actor.userId,
      action: "project.created",
      summary: `Membuat project ${code} dan menugaskan ${pm.name} sebagai PM`,
      stage: 1,
      division: "OPERATIONAL",
      result: "CREATED",
    });

    await notify(tx, {
      userIds: [pm.id],
      message: `Anda ditugaskan ke Project ${code}.`,
      href: projectHref(code, { stage: 1, tab: "pm" }),
    });

    return { code, pmName: pm.name };
  });
}
