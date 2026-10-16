"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { acceptInviteAction } from "./actions";

export default function InvitePage() {
  const params = useParams<{ token: string }>();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  return (
    <main className="mx-auto flex min-h-dvh max-w-md items-center px-6">
      <div className="w-full space-y-4 rounded-xl border border-line bg-white p-6 shadow-sm">
        <h1 className="font-bold text-ink text-xl">Undangan IITrack</h1>
        <p className="text-muted text-sm">
          Tautan ini dari Super Admin. Atur kata sandi Anda, lalu masuk. Email
          otomatis belum dikirim.
        </p>
        {done ? (
          <Alert tone="success">
            Kata sandi tersimpan.{" "}
            <Link href="/login" className="font-semibold underline">
              Masuk
            </Link>
          </Alert>
        ) : (
          <form
            className="space-y-3"
            action={async () => {
              setPending(true);
              setError(null);
              const result = await acceptInviteAction(params.token, password);
              setPending(false);
              if (result.ok) setDone(true);
              else setError(result.error);
            }}
          >
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <TextField
              label="Kata sandi baru"
              name="password"
              type="password"
              minLength={8}
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan kata sandi"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
