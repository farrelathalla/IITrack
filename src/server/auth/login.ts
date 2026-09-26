import { type AuthenticationResult, authenticate } from "@/lib/auth/login";
import { toRoleAssignments } from "@/server/auth/actor";
import { prisma } from "@/server/db";

export interface AttemptLoginInput {
  email: string;
  password: string;
  now?: Date;
}

/**
 * Mencocokkan kredensial. Sengaja tidak menyentuh cookie maupun redirect
 * supaya jalur ini bisa diuji terhadap basis data tanpa menjalankan Next.
 */
export async function attemptLogin(
  input: AttemptLoginInput,
): Promise<AuthenticationResult> {
  const record = await prisma.user.findUnique({
    where: { email: input.email.trim().toLowerCase() },
    select: {
      id: true,
      status: true,
      passwordHash: true,
      roleAssignments: {
        select: {
          role: true,
          endedAt: true,
          period: { select: { startDate: true, endDate: true } },
        },
      },
    },
  });

  return authenticate({
    user: record
      ? {
          id: record.id,
          status: record.status,
          passwordHash: record.passwordHash,
          roleAssignments: toRoleAssignments(record.roleAssignments),
        }
      : null,
    password: input.password,
    now: input.now ?? new Date(),
  });
}
