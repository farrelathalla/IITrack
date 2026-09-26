"use server";

import { revalidatePath } from "next/cache";
import type { Actor, RoleName } from "@/lib/auth/types";
import { changeOwnPassword, updateOwnName } from "@/server/account";
import { saveApprovers, saveTolerance } from "@/server/admin/settings";
import {
  addUser,
  createPeriod,
  editRole,
  resetPassword,
  revokeAccess,
} from "@/server/admin/users";
import { requireActionUser } from "@/server/auth/current";
import { type ActionResult, runAction } from "@/server/project/mutate";
import type { ApprovalKind, ApproverSetting } from "@/server/settings";

async function act(
  fn: (actor: Actor) => Promise<unknown>,
  message?: string,
): Promise<ActionResult> {
  const result = await runAction(async () => {
    const { actor } = await requireActionUser();
    await fn(actor);
    return message;
  });
  if (result.ok) revalidatePath("/", "layout");
  return result;
}

export async function updateNameAction(name: string) {
  return act((actor) => updateOwnName(actor, name), "Nama diperbarui.");
}

export async function changePasswordAction(current: string, next: string) {
  return act(
    (actor) => changeOwnPassword(actor, { current, next }),
    "Kata sandi diganti.",
  );
}

export async function addUserAction(input: {
  name: string;
  email: string;
  role: RoleName;
  periodId: string;
  password: string;
}) {
  return act((actor) => addUser({ actor, input }), "Akun ditambahkan.");
}

export async function editRoleAction(input: {
  userId: string;
  role: RoleName;
  periodId: string;
}) {
  return act((actor) => editRole({ actor, input }), "Jabatan diperbarui.");
}

export async function revokeAccessAction(userId: string, reason: string) {
  return act(
    (actor) => revokeAccess({ actor, input: { userId, reason } }),
    "Akses dicabut.",
  );
}

export async function resetPasswordAction(userId: string, password: string) {
  return act(
    (actor) => resetPassword({ actor, userId, password }),
    "Kata sandi diatur ulang.",
  );
}

export async function createPeriodAction(input: {
  name: string;
  startDate: string;
  endDate: string;
}) {
  return act(
    (actor) =>
      createPeriod({
        actor,
        input: {
          name: input.name,
          startDate: input.startDate
            ? new Date(`${input.startDate}T00:00:00+07:00`)
            : "",
          endDate: input.endDate
            ? new Date(`${input.endDate}T00:00:00+07:00`)
            : "",
        },
      }),
    "Periode dibuat.",
  );
}

export async function saveApproversAction(
  approvers: Partial<Record<ApprovalKind, ApproverSetting>>,
) {
  return act(
    (actor) => saveApprovers({ actor, approvers }),
    "Approver disimpan.",
  );
}

export async function saveToleranceAction(days: string) {
  return act((actor) => saveTolerance({ actor, days }), "Toleransi disimpan.");
}
