import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui";
import { canSeeAction } from "@/lib/auth/ui-visibility";
import { getAuthenticatedSession } from "@/server/auth/session";
import { RegisterProjectForm } from "./register-form";

export const metadata: Metadata = {
  title: "Daftarkan project",
};

export default async function RegisterProjectPage() {
  const session = await getAuthenticatedSession();
  // Layout sudah menjamin sesi ada; penjaga izin form tetap di server.
  // Menu nav juga disembunyikan lewat F03-T04; form tetap dilindungi di sini.
  const bolehDaftar =
    session !== null && canSeeAction(session.actor, "project.create");

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5">
      <div className="flex flex-col gap-1">
        <p className="text-slate-500 text-xs">
          <Link href="/beranda" className="underline-offset-4 hover:underline">
            Beranda
          </Link>
          {" / "}
          Daftarkan project
        </p>
        <h1 className="text-xl">Daftarkan project</h1>
        <p className="text-slate-500">
          Isi data wajib. Nomor Project ID baru terbit setelah pendaftaran
          berhasil — belum lengkap berarti nomor belum dipakai.
        </p>
      </div>

      {bolehDaftar ? (
        <div className="rounded-card border border-line bg-white p-5">
          <RegisterProjectForm />
        </div>
      ) : (
        <Alert tone="danger">
          Jabatan Anda tidak berwenang mendaftarkan project. Minta COO atau
          Project Manager yang sedang aktif untuk mendaftarkannya.
        </Alert>
      )}
    </div>
  );
}
