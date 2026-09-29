import type { Metadata } from "next";
import Link from "next/link";
import { Alert } from "@/components/ui/alert";
import { readInvitation } from "@/server/admin/invitations";
import { LoginScene } from "../../login/login-scene";
import { InvitationForm } from "./invitation-form";

export const metadata: Metadata = {
  title: "Aktivasi Akun",
  robots: { index: false, follow: false },
};

/**
 * Halaman link undangan. Anggota baru membuat kata sandinya sendiri di sini;
 * link yang sama juga dipakai Super Admin untuk membantu anggota yang lupa
 * kata sandi.
 */
export default async function InvitationPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const invitation = await readInvitation(token);

  return (
    <LoginScene
      startOpen
      form={
        <div className="rounded-xl border border-line bg-white p-8 shadow-sm">
          {invitation.status === "valid" ? (
            <>
              <h2 className="font-semibold text-ink text-xl tracking-tight">
                {invitation.hasPassword
                  ? "Atur ulang kata sandi"
                  : `Halo, ${invitation.name}`}
              </h2>
              <p className="mt-1 mb-6 text-muted text-xs">
                {invitation.hasPassword
                  ? `Buat kata sandi baru untuk ${invitation.email}.`
                  : `Buat kata sandi untuk akun IITrack ${invitation.email}. Setelah disimpan kamu langsung masuk.`}
              </p>
              <InvitationForm token={token} email={invitation.email} />
            </>
          ) : (
            <>
              <h2 className="mb-4 font-semibold text-ink text-xl tracking-tight">
                Link tidak bisa dipakai
              </h2>
              <Alert tone="warning">{invitation.reason}</Alert>
              <Link
                href="/login"
                className="mt-6 block text-center font-medium text-plum-600 text-xs hover:underline"
              >
                Ke halaman masuk
              </Link>
            </>
          )}
        </div>
      }
    />
  );
}
