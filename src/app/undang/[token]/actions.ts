"use server";

import { acceptInvite } from "@/server/admin/users";
import { type ActionResult, runAction } from "@/server/project/mutate";

export async function acceptInviteAction(
  token: string,
  password: string,
): Promise<ActionResult> {
  return runAction(async () => {
    await acceptInvite({ token, password });
    return "Kata sandi tersimpan. Silakan masuk.";
  });
}
