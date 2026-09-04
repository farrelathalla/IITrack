"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { authenticate } from "@/lib/auth/login";
import type { Division, RoleName, UserStatus } from "@/lib/auth/types";
import { createSession, revokeCurrentSession } from "@/server/auth/session";
import { prisma } from "@/server/db";

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

  const record = await prisma.user.findUnique({
    where: { email: parsed.data.email.toLowerCase() },
    select: {
      id: true,
      status: true,
      passwordHash: true,
      roleAssignments: {
        select: {
          role: true,
          division: true,
          startDate: true,
          endDate: true,
          isSystemAdmin: true,
        },
      },
    },
  });

  const result = await authenticate({
    user: record
      ? {
          id: record.id,
          status: record.status as UserStatus,
          passwordHash: record.passwordHash,
          roleAssignments: record.roleAssignments.map((assignment) => ({
            role: assignment.role as RoleName,
            division: assignment.division as Division,
            startDate: assignment.startDate,
            endDate: assignment.endDate,
            isSystemAdmin: assignment.isSystemAdmin,
          })),
        }
      : null,
    password: parsed.data.password,
    now: new Date(),
  });

  if (!result.authenticated) {
    return { error: result.reason };
  }

  await createSession(result.userId, (await headers()).get("user-agent"));

  // redirect melempar ke luar, jadi harus di luar percabangan penolakan.
  redirect("/beranda");
}

export async function logoutAction(): Promise<void> {
  await revokeCurrentSession();
  redirect("/login?alasan=logout");
}
