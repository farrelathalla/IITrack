import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/current";
import { listNotifications } from "@/server/notifications";
import { markAllReadAction, openNotificationAction } from "../actions";

export const metadata: Metadata = { title: "Notifikasi" };

/**
 * Notifikasi (PRD bab 8.6): item belum dibaca berlatar ungu muda dengan titik
 * penanda. Klik membuka project pada stage dan tab yang relevan.
 */
export default async function NotificationsPage() {
  const { actor } = await requireUser();
  const items = await listNotifications(actor.userId, 200);
  const unread = items.filter((n) => !n.readAt).length;

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-bold text-ink text-xl">Notifikasi</h1>
          <p className="mt-0.5 text-muted text-xs">
            {unread > 0
              ? `${unread} belum dibaca`
              : "Semua notifikasi sudah dibaca."}
          </p>
        </div>
        {unread > 0 ? (
          <form action={markAllReadAction}>
            <Button type="submit" variant="secondary" size="sm">
              Tandai semua dibaca
            </Button>
          </form>
        ) : null}
      </div>
      <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
        {items.length === 0 ? (
          <p className="p-10 text-center text-xs text-subtle">
            Belum ada notifikasi.
          </p>
        ) : (
          items.map((item) => (
            <form
              key={item.id}
              action={openNotificationAction.bind(null, item.id)}
            >
              <button
                type="submit"
                className={cn(
                  "flex w-full gap-3 border-surface border-b px-5 py-4 text-left transition-colors last:border-0 hover:bg-surface",
                  !item.readAt && "bg-plum-50",
                )}
              >
                <span
                  className={cn(
                    "mt-1.5 size-2 shrink-0 rounded-full",
                    item.readAt ? "bg-transparent" : "bg-plum-600",
                  )}
                />
                <span className="flex-1">
                  <span
                    className={cn(
                      "block text-xs",
                      item.readAt ? "text-muted" : "font-medium text-ink",
                    )}
                  >
                    {item.message}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-subtle">
                    {formatDateTime(item.createdAt)}
                  </span>
                </span>
              </button>
            </form>
          ))
        )}
      </div>
    </div>
  );
}
