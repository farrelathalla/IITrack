import type { RoleName } from "@/lib/auth/types";
import type { Tx } from "@/server/activity";

/**
 * Pengguna aktif yang saat ini memegang salah satu jabatan tersebut.
 * Dipakai untuk notifikasi ke approver berdasarkan jabatan (PRD bab 11).
 */
export async function activeUsersWithRoles(
  tx: Tx,
  roles: readonly RoleName[],
  now: Date = new Date(),
): Promise<string[]> {
  const rows = await tx.roleAssignment.findMany({
    where: {
      role: { in: [...roles] },
      OR: [{ endedAt: null }, { endedAt: { gt: now } }],
      period: { startDate: { lte: now }, endDate: { gt: now } },
      user: { status: "ACTIVE" },
    },
    select: { userId: true },
  });
  return [...new Set(rows.map((row) => row.userId))];
}

export interface NotificationInput {
  userIds: readonly (string | null | undefined)[];
  message: string;
  href?: string | null;
  /** Pelaku tidak perlu diberi tahu atas tindakannya sendiri. */
  exceptUserId?: string | null;
}

export async function notify(tx: Tx, input: NotificationInput): Promise<void> {
  const recipients = [
    ...new Set(
      input.userIds.filter(
        (id): id is string => Boolean(id) && id !== input.exceptUserId,
      ),
    ),
  ];
  if (recipients.length === 0) return;

  await tx.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      message: input.message,
      href: input.href ?? null,
    })),
  });
}

export async function notifyRoles(
  tx: Tx,
  roles: readonly RoleName[],
  input: Omit<NotificationInput, "userIds">,
): Promise<void> {
  await notify(tx, {
    ...input,
    userIds: await activeUsersWithRoles(tx, roles),
  });
}

/** Tautan tujuan notifikasi: project pada stage dan tab yang relevan. */
export function projectHref(
  code: string,
  options: { stage?: number; tab?: "pm" | "tech" | "finance" } = {},
): string {
  const params = new URLSearchParams();
  if (options.stage) params.set("stage", String(options.stage));
  if (options.tab) params.set("tab", options.tab);
  const query = params.toString();
  return `/projects/${code}${query ? `?${query}` : ""}`;
}
