import { z } from "zod";
import { canGlobally, canManageApprover } from "@/lib/auth/access";
import type { Actor } from "@/lib/auth/types";
import { recordActivity } from "@/server/activity";
import { activeUsersByRoles } from "@/server/admin/users";
import { viewerOf } from "@/server/auth/actor";
import { prisma } from "@/server/db";
import { ActionError, parseInput } from "@/server/project/mutate";
import {
  APPROVAL_KIND_INFO,
  APPROVAL_KINDS,
  APPROVER_ROLES,
  type ApprovalKind,
  type ApproverSetting,
  getSettings,
} from "@/server/settings";

function requireSuperAdmin(actor: Actor) {
  const decision = canGlobally(viewerOf(actor), "settings.manage");
  if (!decision.allowed) throw new ActionError(decision.reason);
}

/**
 * Perbarui approver utama dan delegasi (Workflow & Approver). Super Admin
 * mengatur semua jenis; C-Level hanya jenis pengajuan divisinya. Orang yang
 * dipilih harus memegang jabatan approver jenis tersebut.
 */
export async function saveApprovers(params: {
  actor: Actor;
  approvers: Partial<Record<ApprovalKind, ApproverSetting>>;
}): Promise<void> {
  const viewer = viewerOf(params.actor);
  const kinds = APPROVAL_KINDS.filter((kind) => params.approvers[kind]);
  if (kinds.length === 0) return;
  for (const kind of kinds) {
    if (!canManageApprover(viewer.role, kind)) {
      throw new ActionError(
        `Kamu tidak berwenang mengatur approver ${APPROVAL_KIND_INFO[kind].label}.`,
      );
    }
  }

  const current = await getSettings();
  const next = { ...current.approvers };
  for (const kind of kinds) {
    const value = params.approvers[kind];
    if (!value) continue;
    const ids = [value.primaryUserId, value.delegateUserId].filter(
      (id): id is string => Boolean(id),
    );
    if (ids.length > 0) {
      const eligible = await activeUsersByRoles(APPROVER_ROLES[kind]);
      const bad = ids.find((id) => !eligible.some((u) => u.id === id));
      if (bad) {
        throw new ActionError(
          `Approver ${APPROVAL_KIND_INFO[kind].label} harus pemegang jabatan ${APPROVAL_KIND_INFO[kind].approverLabel} yang aktif.`,
        );
      }
    }
    next[kind] = {
      primaryUserId: value.primaryUserId || null,
      delegateUserId: value.delegateUserId || null,
    };
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
      summary: `Memperbarui approver: ${kinds
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
