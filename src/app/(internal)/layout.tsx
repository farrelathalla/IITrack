import { logoutAction } from "@/app/(auth)/login/actions";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { roleLabel } from "@/lib/auth/access";
import { formatDateTimeShort } from "@/lib/time";
import { requireUser } from "@/server/auth/current";
import { listNotifications, unreadCount } from "@/server/notifications";

/**
 * Halaman internal tidak boleh disimpan peramban. Tanpa ini, tombol Back
 * setelah logout masih bisa menampilkan halaman terakhir dari cache walaupun
 * sesinya sudah dicabut di server.
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { actor, viewer } = await requireUser();
  const [recent, unread] = await Promise.all([
    listNotifications(actor.userId, 8),
    unreadCount(actor.userId),
  ]);

  return (
    <div className="min-h-dvh bg-surface">
      <Sidebar
        name={actor.name}
        roleLabel={roleLabel(viewer.role)}
        unread={unread}
        logoutAction={logoutAction}
      />
      <div className="flex min-h-dvh flex-col pl-60">
        <TopNav
          name={actor.name}
          unread={unread}
          notifications={recent.map((n) => ({
            id: n.id,
            message: n.message,
            time: formatDateTimeShort(n.createdAt),
            unread: n.readAt === null,
          }))}
        />
        <main className="flex-1">{children}</main>
      </div>
    </div>
  );
}
