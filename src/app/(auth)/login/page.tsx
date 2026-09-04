import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk",
};

/** Pesan yang menjelaskan kenapa pengguna kembali ke halaman masuk. */
const REASONS: Record<string, string> = {
  logout: "Anda sudah keluar dari IITrack.",
  sesi: "Sesi Anda sudah berakhir. Silakan masuk kembali.",
  jabatan:
    "Masa jabatan Anda sudah berakhir, sehingga sesinya ikut berakhir. Minta pengurus TechDev memperbarui periode jabatan Anda bila ini keliru.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ alasan?: string }>;
}) {
  const { alasan } = await searchParams;
  const notice = alasan ? REASONS[alasan] : undefined;

  return (
    <div className="min-h-dvh bg-surface-alt">
      {/* Satu-satunya elemen gradien di halaman ini (Design Brief bab 1). */}
      <div className="pita-gradien" />

      <main className="mx-auto flex min-h-[calc(100dvh-3px)] w-full max-w-sm flex-col justify-center gap-5 px-6 py-12">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl">Masuk ke IITrack</h1>
          <p className="text-slate-500">
            Akun dibuat lewat undangan pengurus. Tidak ada pendaftaran mandiri.
          </p>
        </div>

        {notice ? (
          <p
            role="status"
            className="rounded-card border border-amber-text/20 bg-amber-bg px-3 py-2 text-amber-text"
          >
            {notice}
          </p>
        ) : null}

        <div className="rounded-card border border-line bg-white p-5">
          <LoginForm />
        </div>
      </main>
    </div>
  );
}
