import { prisma } from "@/server/db";

export async function listNotifications(userId: string, take = 50) {
  return prisma.notification.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take,
  });
}

export async function unreadCount(userId: string): Promise<number> {
  return prisma.notification.count({ where: { userId, readAt: null } });
}

/** Menandai sudah dibaca. Hanya notifikasi milik pengguna itu sendiri. */
export async function markRead(
  userId: string,
  notificationId: string,
): Promise<string | null> {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
    select: { id: true, href: true, readAt: true },
  });
  if (!notification) return null;
  if (!notification.readAt) {
    await prisma.notification.update({
      where: { id: notification.id },
      data: { readAt: new Date() },
    });
  }
  return notification.href;
}

export async function markAllRead(userId: string): Promise<void> {
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
}
