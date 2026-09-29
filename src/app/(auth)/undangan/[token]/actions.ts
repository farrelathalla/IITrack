"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { acceptInvitation } from "@/server/admin/invitations";
import { createSession } from "@/server/auth/session";
import { ActionError } from "@/server/project/mutate";

export interface InvitationFormState {
  error: string | null;
}

/** Simpan kata sandi dari link undangan, lalu langsung masuk. */
export async function acceptInvitationAction(
  token: string,
  _previous: InvitationFormState,
  formData: FormData,
): Promise<InvitationFormState> {
  let userId: string;
  try {
    userId = await acceptInvitation({
      token,
      password: String(formData.get("password") ?? ""),
      confirm: String(formData.get("confirm") ?? ""),
    });
  } catch (error) {
    if (error instanceof ActionError) return { error: error.message };
    throw error;
  }

  const requestHeaders = await headers();
  await createSession(userId, requestHeaders.get("user-agent"));
  // redirect melempar ke luar, jadi harus di luar try/catch.
  redirect("/");
}
