"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { attemptLogin } from "@/server/auth/login";
import { createSession, revokeCurrentSession } from "@/server/auth/session";

const credentials = z.object({
  email: z.string().trim().min(1),
  password: z.string().min(1),
});

export interface LoginState {
  error: string | null;
}

export async function loginAction(
  _previous: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = credentials.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { error: "Email dan kata sandi wajib diisi." };
  }

  const requestHeaders = await headers();

  const result = await attemptLogin({
    email: parsed.data.email,
    password: parsed.data.password,
    ipAddress: requestHeaders.get("x-forwarded-for"),
  });

  if (!result.authenticated) {
    return { error: result.reason };
  }

  await createSession(result.userId, requestHeaders.get("user-agent"));

  // redirect melempar ke luar, jadi harus di luar percabangan penolakan.
  redirect("/beranda");
}

export async function logoutAction(): Promise<void> {
  await revokeCurrentSession();
  redirect("/login?alasan=logout");
}
