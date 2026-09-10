import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { type AuthenticationResult, authenticate } from "@/lib/auth/login";
import type { Division, RoleName, UserStatus } from "@/lib/auth/types";
import { recordAudit } from "@/server/audit";
import { prisma } from "@/server/db";

export interface AttemptLoginInput {
  email: string;
  password: string;
  ipAddress?: string | null;
  now?: Date;
}

/**
 * Mencocokkan kredensial dan mencatat jejaknya, baik berhasil maupun gagal.
 *
 * Sengaja tidak menyentuh cookie maupun redirect supaya jalur ini bisa diuji
 * terhadap basis data tanpa menjalankan Next. Server action yang memanggilnya
 * yang mengurus sesi dan perpindahan halaman.
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
    password: input.password,
    now: input.now ?? new Date(),
  });

  if (result.authenticated) {
    await recordAudit({
      actorId: result.userId,
      action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
      objectType: AUDIT_OBJECTS.USER,
      objectId: result.userId,
      ipAddress: input.ipAddress,
    });

    return result;
  }

  // Pelaku hanya diisi bila emailnya memang terdaftar; email asing tidak
  // membuat entri bernama.
  await recordAudit({
    actorId: record?.id ?? null,
    action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
    objectType: AUDIT_OBJECTS.USER,
    objectId: record?.id ?? null,
    reason: result.reason,
    ipAddress: input.ipAddress,
  });

  return result;
}
