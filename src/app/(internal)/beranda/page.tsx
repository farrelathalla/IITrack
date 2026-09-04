import type { Metadata } from "next";
import { getAuthenticatedSession } from "@/server/auth/session";

export const metadata: Metadata = {
  title: "Beranda",
};

export default async function BerandaPage() {
  // Layout internal sudah menolak permintaan tanpa sesi yang sah.
  const session = await getAuthenticatedSession();
  const roles = session?.actor.roleAssignments.map((a) => a.role) ?? [];

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl">Beranda</h1>

      <p className="max-w-prose text-slate-500">
        Daftar project dan Project Hub (F08) menyusul pada pekerjaan Sprint 0
        berikutnya. Halaman ini sementara hanya menandai bahwa sesi Anda
        berlaku.
      </p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-slate-500">Jabatan aktif:</span>
        {roles.map((role) => (
          <span
            key={role}
            className="rounded-full bg-plum-50 px-2.5 py-1 font-medium text-plum-900 text-xs"
          >
            {role}
          </span>
        ))}
      </div>
    </div>
  );
}
