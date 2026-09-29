import { z } from "zod";
import type { Actor } from "@/lib/auth/types";
import {
  PROJECT_SOURCE_LABELS,
  PROJECT_TYPE_LABELS,
} from "@/lib/project/catalog";
import { developersOf, financePocOf, pmOf } from "@/lib/project/snapshot";
import { formatDate } from "@/lib/time";
import { recordActivity } from "@/server/activity";
import { notify } from "@/server/notify";
import { projectDetailFields, targetOrder } from "./create";
import { ActionError, mutateProject, parseInput } from "./mutate";

const detailsSchema = z
  .object(projectDetailFields)
  .refine(targetOrder.check, targetOrder.params);

export type ProjectDetailsInput = z.input<typeof detailsSchema>;

const LABELS = {
  name: "Nama",
  client: "Client",
  type: "Tipe",
  source: "Sumber",
  targetStart: "Target mulai",
  targetEnd: "Target selesai",
  internalNote: "Catatan internal",
} as const;

type Field = keyof typeof LABELS;

function display(field: Field, value: unknown): string {
  if (value === null || value === undefined || value === "") return "-";
  if (value instanceof Date) return formatDate(value);
  if (field === "type") {
    return PROJECT_TYPE_LABELS[value as keyof typeof PROJECT_TYPE_LABELS];
  }
  if (field === "source") {
    return PROJECT_SOURCE_LABELS[value as keyof typeof PROJECT_SOURCE_LABELS];
  }
  return String(value);
}

function same(a: unknown, b: unknown): boolean {
  if (a instanceof Date && b instanceof Date)
    return a.getTime() === b.getTime();
  return (a ?? null) === (b ?? null);
}

/**
 * Edit Detail: nama, client, tipe, sumber, target tanggal, dan catatan
 * internal. Project ID tidak ikut berubah. Setiap perubahan dicatat beserta
 * nilai lama dan barunya.
 */
export async function updateProjectDetails(params: {
  actor: Actor;
  projectId: string;
  input: ProjectDetailsInput;
}): Promise<void> {
  const input = parseInput(detailsSchema, params.input);

  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "project.edit",
    run: async ({ tx, project }) => {
      const changes = (Object.keys(LABELS) as Field[]).filter(
        (field) => !same(project[field], input[field]),
      );
      if (changes.length === 0) return;

      await tx.project.update({
        where: { id: project.id },
        data: input,
      });
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "project.details_updated",
        summary: `Mengubah detail project: ${changes
          .map(
            (field) =>
              `${LABELS[field]} ${display(field, project[field])} → ${display(field, input[field])}`,
          )
          .join("; ")}`,
        division: "OPERATIONAL",
        data: Object.fromEntries(
          changes.map((field) => [
            field,
            { from: project[field] ?? null, to: input[field] ?? null },
          ]),
        ),
      });
    },
  });
}

/**
 * Hapus project (soft delete). Project hilang dari semua daftar dan tidak bisa
 * dibuka lagi, tetapi datanya dan riwayat aktivitasnya tetap tersimpan, dan
 * Project ID-nya tidak dipakai ulang.
 */
export async function deleteProject(params: {
  actor: Actor;
  projectId: string;
  reason: string;
}): Promise<void> {
  const reason = parseInput(
    z.string().trim().min(1, "Alasan penghapusan wajib diisi."),
    params.reason,
  );

  await mutateProject({
    actor: params.actor,
    projectId: params.projectId,
    action: "project.delete",
    run: async ({ tx, project, now }) => {
      const updated = await tx.project.updateMany({
        where: { id: project.id, deletedAt: null },
        data: {
          deletedAt: now,
          deletedById: params.actor.userId,
          deleteReason: reason,
        },
      });
      if (updated.count === 0) {
        throw new ActionError("Project ini sudah dihapus.");
      }
      await recordActivity(tx, {
        projectId: project.id,
        actorId: params.actor.userId,
        action: "project.deleted",
        summary: `Menghapus project ${project.code}: ${reason}`,
        division: "OPERATIONAL",
        result: "REJECTED",
        feedback: reason,
      });
      await notify(tx, {
        userIds: [
          pmOf(project)?.userId,
          financePocOf(project)?.userId,
          ...developersOf(project).map((d) => d.userId),
        ],
        message: `Project ${project.code} (${project.name}) dihapus. Alasan: ${reason}`,
        exceptUserId: params.actor.userId,
      });
    },
  });
}
