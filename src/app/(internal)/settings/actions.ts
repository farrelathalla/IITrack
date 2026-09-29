"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import type { Actor, RoleName } from "@/lib/auth/types";
import { changeOwnPassword, updateOwnName } from "@/server/account";
import { invitationPath, issueInvitation } from "@/server/admin/invitations";
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

/** Hasil aksi yang bisa membawa link undangan untuk disalin Super Admin. */
export type LinkResult = ActionResult & { link?: string };

/** Origin aplikasi dari permintaan saat ini, untuk link undangan lengkap. */
async function appOrigin(): Promise<string> {
  const fromEnv = process.env.APP_URL?.replace(/\/$/, "");
  if (fromEnv) return fromEnv;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto =
    h.get("x-forwarded-proto") ??
    (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function addUserAction(input: {
  name: string;
  email: string;
  role: RoleName;
  periodId: string;
  password: string;
}): Promise<LinkResult> {
  let token: string | null = null;
  const result = await act(async (actor) => {
    token = await addUser({ actor, input });
  }, "Akun ditambahkan.");
  if (!result.ok || !token) return result;
  return { ...result, link: `${await appOrigin()}${invitationPath(token)}` };
}

export async function issueInvitationAction(
  userId: string,
): Promise<LinkResult> {
  let token = "";
  const result = await act(async (actor) => {
    token = await issueInvitation({ actor, userId });
  }, "Link baru dibuat. Link sebelumnya tidak berlaku lagi.");
  if (!result.ok) return result;
  return { ...result, link: `${await appOrigin()}${invitationPath(token)}` };
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
