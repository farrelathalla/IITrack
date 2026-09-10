import type { Metadata } from "next";
import Image from "next/image";
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
    redirect("/beranda");
  }

  const { alasan } = await searchParams;
  const notice = noticeForAlasan(alasan);

  return (
    <div className="min-h-dvh bg-surface-alt">
      {/* Satu-satunya elemen gradien di halaman ini (Design Brief bab 1). */}
      <div className="pita-gradien" />

      <main className="mx-auto flex min-h-[calc(100dvh-3px)] w-full max-w-sm flex-col justify-center gap-5 px-6 py-12">
        <div className="flex flex-col gap-3">
          <Image
            src="/logo-iit.png"
            alt="Inkubator IT"
            width={48}
            height={48}
            priority
            className="size-12"
          />
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl">Masuk ke IITrack</h1>
            <p className="text-slate-500">
              Akun dibuat lewat undangan pengurus. Tidak ada pendaftaran
              mandiri.
            </p>
          </div>
        </div>

        {notice ? <Alert tone="status">{notice}</Alert> : null}

        <div className="rounded-card border border-line bg-white p-5">
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
