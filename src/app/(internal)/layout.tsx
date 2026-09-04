import { redirect } from "next/navigation";
import { logoutAction } from "@/app/(auth)/login/actions";
import { getAuthenticatedSession } from "@/server/auth/session";

/**
 * Halaman internal tidak boleh disimpan peramban. Tanpa ini, tombol Back
 * setelah logout masih bisa menampilkan halaman terakhir dari cache walaupun
 * sesinya sudah dicabut di server (UAT-AUTH-007).
 */
export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function InternalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getAuthenticatedSession();

  if (!session) {
    redirect("/login?alasan=sesi");
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between border-black/10 border-b px-6 py-3 dark:border-white/15">
        <span className="font-semibold">IITrack</span>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-sm underline underline-offset-4"
          >
            Keluar
          </button>
        </form>
      </header>
      <main className="flex-1 px-6 py-8">{children}</main>
    </div>
  );
}
