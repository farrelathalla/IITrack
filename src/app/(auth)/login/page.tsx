import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Masuk — IITrack",
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
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center gap-6 px-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-semibold text-2xl">Masuk ke IITrack</h1>
        <p className="text-black/60 text-sm dark:text-white/60">
          Akun dibuat lewat undangan pengurus. Tidak ada pendaftaran mandiri.
        </p>
      </div>

      {notice ? (
        <p
          role="status"
          className="rounded-md border border-black/10 bg-black/[.03] px-3 py-2 text-sm dark:border-white/15 dark:bg-white/[.04]"
        >
          {notice}
        </p>
      ) : null}

      <LoginForm />
    </main>
  );
}
