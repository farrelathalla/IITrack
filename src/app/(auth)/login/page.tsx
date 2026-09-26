import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Alert } from "@/components/ui/alert";
import { noticeForAlasan } from "@/lib/auth/login-notice";
import { getAuthenticatedSession } from "@/server/auth/session";
import { LoginForm } from "./login-form";
import { LoginScene } from "./login-scene";

export const metadata: Metadata = {
  title: "Masuk",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ alasan?: string }>;
}) {
  if (await getAuthenticatedSession()) {
    redirect("/");
  }

  const { alasan } = await searchParams;
  const notice = noticeForAlasan(alasan);

  return (
    <LoginScene
      startOpen={notice != null}
      form={
        <div className="rounded-xl border border-line bg-white p-8 shadow-sm">
          <h2 className="mb-6 font-semibold text-ink text-xl tracking-tight">
            Masuk
          </h2>
          {notice ? (
            <Alert tone="warning" className="mb-5">
              {notice}
            </Alert>
          ) : null}
          <LoginForm />
          <p className="mt-6 text-center text-subtle text-xs">
            Akun dibuat oleh Super Admin.
          </p>
        </div>
      }
    />
  );
}
