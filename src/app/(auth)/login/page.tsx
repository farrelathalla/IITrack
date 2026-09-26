import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { noticeForAlasan } from "@/lib/auth/login-notice";
import { getAuthenticatedSession } from "@/server/auth/session";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ alasan?: string }>;
}) {
  // Pengguna yang sesinya masih sah tidak perlu melihat formulir masuk lagi.
  if (await getAuthenticatedSession()) {
    redirect("/");
  }

  const { alasan } = await searchParams;
  const notice = noticeForAlasan(alasan);

  return (
    <div className="flex min-h-dvh">
      <aside className="hidden w-[420px] shrink-0 flex-col justify-between bg-navy-900 p-10 lg:flex">
        <div className="flex items-center gap-2.5">
          <LogoMark />
          <div>
            <p className="font-bold text-sm text-white leading-tight">
              IITrack
            </p>
            <p className="text-[10px] text-navy-400 leading-tight">
              Inkubator IT HMIF ITB
            </p>
          </div>
        </div>
        <div className="space-y-3">
          <p className="font-bold text-2xl text-white leading-snug">
            Satu project, satu Project ID.
          </p>
          <p className="text-navy-300 text-sm leading-relaxed">
            Project Management, Technology Dev, dan Finance bekerja di atas
            record yang sama, dari penugasan PM sampai project ditutup.
          </p>
        </div>
        <p className="text-[11px] text-navy-500">
          Sistem Alur Kerja Lintas Divisi
        </p>
      </aside>

      <main className="flex flex-1 items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm space-y-5">
          <div className="flex items-center gap-2.5 lg:hidden">
            <LogoMark />
            <p className="font-bold text-ink">IITrack</p>
          </div>
          <div className="space-y-1">
            <h1 className="font-bold text-ink text-xl">Masuk ke IITrack</h1>
            <p className="text-muted text-sm">
              Gunakan akun IIT Anda. Akun dibuat oleh Super Admin; tidak ada
              pendaftaran mandiri.
            </p>
          </div>

          {notice ? <Alert tone="warning">{notice}</Alert> : null}

          <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
            <LoginForm />
          </div>
        </div>
      </main>
    </div>
  );
}

function LogoMark() {
  return (
    <span className="flex size-8 items-center justify-center rounded-lg bg-plum-600">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4 text-white"
        aria-hidden="true"
      >
        <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
      </svg>
    </span>
  );
}
