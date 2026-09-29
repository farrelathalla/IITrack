import type { z } from "zod";
import {
  canOnProject,
  type ProjectAccess,
  type ProjectAction,
  type Viewer,
} from "@/lib/auth/access";
import type { Actor } from "@/lib/auth/types";
import type { ProjectSnapshot } from "@/lib/project/snapshot";
import { deriveStages, type StageState } from "@/lib/project/stages";
import { fieldErrors } from "@/lib/validation";
import type { Tx } from "@/server/activity";
import { viewerOf } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { loadApproverRules } from "@/server/settings";
import { accessOf, loadSnapshot, syncStageCompletion } from "./snapshot";

/**
 * Penolakan yang pesannya berbahasa pengguna dan boleh ditampilkan apa adanya
 * (PRD bab 13, "Pesan yang jelas").
 */
export class ActionError extends Error {
  readonly fields?: Record<string, string>;

  constructor(message: string, fields?: Record<string, string>) {
    super(message);
    this.name = "ActionError";
    this.fields = fields;
  }
}

export type ActionResult =
  | { ok: true; message?: string }
  | { ok: false; error: string; fields?: Record<string, string> };

/** Membaca input dengan zod; galatnya dilempar sebagai ActionError. */
export function parseInput<T extends z.ZodType>(
  schema: T,
  input: unknown,
): z.output<T> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    const fields = fieldErrors(parsed.error);
    throw new ActionError(
      Object.values(fields)[0] ?? "Isian belum valid.",
      fields,
    );
  }
  return parsed.data;
}

export interface MutationContext {
  tx: Tx;
  project: ProjectSnapshot;
  stages: StageState[];
  viewer: Viewer;
  access: ProjectAccess;
  actor: Actor;
  now: Date;
}

export interface MutateProjectInput<T> {
  actor: Actor;
  projectId: string;
  /** Aksi yang diperiksa. Bila lebih dari satu, cukup salah satu yang boleh. */
  action: ProjectAction | readonly ProjectAction[];
  now?: Date;
  run: (context: MutationContext) => Promise<T>;
}

/**
 * Jalur tunggal perubahan data project: muat potret, periksa izin di server,
 * jalankan perubahan dalam satu transaksi, lalu catat stage yang baru selesai.
 * Izin diperiksa di sini, bukan di tampilan, sehingga permintaan langsung ke
 * server tetap ditolak (PRD bab 1.1 dan 13).
 */
export async function mutateProject<T>(
  input: MutateProjectInput<T>,
): Promise<T> {
  const now = input.now ?? new Date();
  const viewer = viewerOf(input.actor, now);

  return prisma.$transaction(async (tx) => {
    const project = await loadSnapshot(input.projectId, tx);
    if (!project) throw new ActionError("Project tidak ditemukan.");

    const access = {
      ...accessOf(project),
      approvers: await loadApproverRules(tx, now),
    };
    const actions = Array.isArray(input.action)
      ? (input.action as readonly ProjectAction[])
      : [input.action as ProjectAction];
    const decisions = actions.map((a) => canOnProject(viewer, a, access));
    const allowed = decisions.find((d) => d.allowed);
    if (!allowed) {
      const first = decisions[0];
      throw new ActionError(
        first && !first.allowed ? first.reason : "Anda tidak berwenang.",
      );
    }

    const stages = deriveStages(project, now);
    const result = await input.run({
      tx,
      project,
      stages,
      viewer,
      access,
      actor: input.actor,
      now,
    });

    const fresh = await loadSnapshot(project.id, tx);
    if (fresh) await syncStageCompletion(tx, fresh, input.actor.userId, now);

    return result;
  });
}

/** Menjalankan aksi server dan menerjemahkan penolakan menjadi ActionResult. */
export async function runAction(
  fn: () => Promise<unknown>,
): Promise<ActionResult> {
  try {
    const message = await fn();
    return {
      ok: true,
      message: typeof message === "string" ? message : undefined,
    };
  } catch (error) {
    if (error instanceof ActionError) {
      return { ok: false, error: error.message, fields: error.fields };
    }
    if (isUniqueViolation(error)) {
      return {
        ok: false,
        error:
          "Data ini baru saja diubah orang lain. Muat ulang halaman lalu coba lagi.",
      };
    }
    throw error;
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === "P2002"
  );
}

/** Stage wajib terbuka sebelum isinya boleh diubah. */
export function requireStageOpen(
  stages: readonly StageState[],
  n: number,
): void {
  const stage = stages.find((s) => s.n === n);
  if (!stage || stage.status === "locked") {
    throw new ActionError(stage?.lockedReason ?? `Stage ${n} masih terkunci.`);
  }
}
