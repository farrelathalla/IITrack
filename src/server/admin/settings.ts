import { z } from "zod";
import { canGlobally } from "@/lib/auth/access";
import type { Actor } from "@/lib/auth/types";
import { recordActivity } from "@/server/activity";
import { viewerOf } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { ActionError, parseInput } from "@/server/project/mutate";
import {
  APPROVAL_KIND_INFO,
  APPROVAL_KINDS,
  type ApprovalKind,
  type ApproverSetting,
  getSettings,
} from "@/server/settings";

function requireSuperAdmin(actor: Actor) {
  const decision = canGlobally(viewerOf(actor), "settings.manage");
  if (!decision.allowed) throw new ActionError(decision.reason);
}

/** Perbarui approver utama dan delegasi (PRD bab 8.7, Workflow & Approver). */
export async function saveApprovers(params: {
  actor: Actor;
  approvers: Partial<Record<ApprovalKind, ApproverSetting>>;
}): Promise<void> {
  requireSuperAdmin(params.actor);
  const current = await getSettings();
  const next = { ...current.approvers };
  for (const kind of APPROVAL_KINDS) {
    const value = params.approvers[kind];
    if (value) {
      next[kind] = {
        primaryUserId: value.primaryUserId || null,
        delegateUserId: value.delegateUserId || null,
      };
    }
  }

  await prisma.$transaction(async (tx) => {
    await tx.setting.upsert({
      where: { key: "approvers" },
      create: { key: "approvers", value: next },
      update: { value: next },
    });
    await recordActivity(tx, {
      actorId: params.actor.userId,
      action: "settings.approvers",
      summary: `Memperbarui approver: ${APPROVAL_KINDS.filter(
        (k) => params.approvers[k],
      )
        .map((k) => APPROVAL_KIND_INFO[k].label)
        .join(", ")}`,
      division: "SYSTEM",
    });
  });
}

/** Toleransi status final dalam hari (PRD bab 4.12). */
export async function saveTolerance(params: {
  actor: Actor;
  days: number | string;
}): Promise<void> {
  requireSuperAdmin(params.actor);
  const days = parseInput(
    z.coerce.number().int("Toleransi harus bilangan bulat.").min(0).max(90),
    params.days,
  );
  await prisma.$transaction(async (tx) => {
    await tx.setting.upsert({
      where: { key: "finalStatusToleranceDays" },
      create: { key: "finalStatusToleranceDays", value: days },
      update: { value: days },
    });
    await recordActivity(tx, {
      actorId: params.actor.userId,
      action: "settings.tolerance",
      summary: `Mengubah toleransi status final menjadi ${days} hari`,
      division: "SYSTEM",
    });
  });
}
