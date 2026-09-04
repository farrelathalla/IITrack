import { getAuthenticatedSession } from "@/server/auth/session";

export default async function BerandaPage() {
  // Layout internal sudah menolak permintaan tanpa sesi yang sah.
  const session = await getAuthenticatedSession();

  return (
    <div className="flex flex-col gap-2">
      <h1 className="font-semibold text-xl">Beranda</h1>
      <p className="text-black/60 text-sm dark:text-white/60">
        Daftar project dan Project Hub (F08) menyusul pada pekerjaan Sprint 0
        berikutnya. Halaman ini sementara hanya menandai bahwa sesi Anda
        berlaku.
      </p>
      <p className="text-black/60 text-sm dark:text-white/60">
        Jabatan aktif:{" "}
        {session?.actor.roleAssignments.map((a) => a.role).join(", ")}
      </p>
    </div>
  );
}
