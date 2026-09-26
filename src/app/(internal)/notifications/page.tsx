import type { Metadata } from "next";
import { NotificationList } from "@/app/(internal)/notifications/notification-list";
import { formatDateTime } from "@/lib/time";
import { requireUser } from "@/server/auth/current";
import { listNotifications } from "@/server/notifications";

export const metadata: Metadata = { title: "Notifications" };

/**
 * Notifikasi (PRD bab 8.6). Klik membuka project pada stage dan tab yang
 * relevan. Filter All/Unread hanya menyaring daftar yang sudah diambil.
 */
export default async function NotificationsPage() {
  const { actor } = await requireUser();
  const items = await listNotifications(actor.userId, 200);
  const unread = items.filter((item) => !item.readAt).length;

  return (
    <div className="mx-auto max-w-5xl space-y-5 p-6">
      <div>
        <h1 className="font-bold text-ink text-xl">Notifications</h1>
        <p className="mt-0.5 text-muted text-xs">
          {unread > 0
            ? `${unread} belum dibaca`
            : "Updates and actions related to your projects."}
        </p>
      </div>
      <NotificationList
        items={items.map((item) => ({
          id: item.id,
          message: item.message,
          time: formatDateTime(item.createdAt),
          unread: item.readAt === null,
        }))}
      />
    </div>
  );
}
