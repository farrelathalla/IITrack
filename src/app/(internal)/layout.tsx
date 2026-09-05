import { redirect } from "next/navigation";
import { logoutAction } from "@/app/(auth)/login/actions";
import { inspectSession } from "@/server/auth/session";

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
  const inspection = await inspectSession();

  if (inspection.kind === "anonymous") {
    // Belum ada cookie/sesi — jangan menampilkan pesan "sesi berakhir".
    redirect("/login");
  }

  if (inspection.kind === "ended") {
    redirect(`/login?alasan=${inspection.alasan}`);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-white">
      {/* Satu-satunya elemen gradien per halaman (Design Brief bab 1). */}
      <div className="pita-gradien" />

      <header className="flex items-center justify-between border-line border-b px-6 py-3">
        <div className="flex items-center gap-4">
          <a href="/beranda" className="font-semibold text-plum-900">
            IITrack
          </a>
          <nav className="flex items-center gap-3 text-slate-500 text-sm">
            <a
              href="/beranda"
              className="underline-offset-4 hover:text-plum-900 hover:underline"
            >
              Beranda
            </a>
            <a
              href="/projects/baru"
              className="underline-offset-4 hover:text-plum-900 hover:underline"
            >
              Daftarkan project
            </a>
            <a
              href="/pengurus"
              className="underline-offset-4 hover:text-plum-900 hover:underline"
            >
              Pengurus
            </a>
          </nav>
        </div>
        <form action={logoutAction}>
          <button
            type="submit"
            className="text-slate-500 underline underline-offset-4 hover:text-plum-900"
          >
            Keluar
          </button>
        </form>
      </header>

      <main className="flex-1 px-6 py-6">{children}</main>
    </div>
  );
}
