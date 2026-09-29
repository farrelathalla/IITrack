"use client";

import { useActionState } from "react";
import { Alert, Button, TextField } from "@/components/ui";
import { acceptInvitationAction, type InvitationFormState } from "./actions";

const INITIAL: InvitationFormState = { error: null };

export function InvitationForm({
  token,
  email,
}: {
  token: string;
  email: string;
}) {
  const [state, formAction, pending] = useActionState(
    acceptInvitationAction.bind(null, token),
    INITIAL,
  );

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {/* Bantu pengelola kata sandi menyimpan pasangan email dan sandi. */}
      <input
        type="email"
        name="username"
        autoComplete="username"
        value={email}
        readOnly
        hidden
      />
      <TextField
        label="Kata sandi baru"
        type="password"
        name="password"
        autoComplete="new-password"
        minLength={8}
        required
        hint="Minimal 8 karakter."
      />
      <TextField
        label="Ulangi kata sandi"
        type="password"
        name="confirm"
        autoComplete="new-password"
        minLength={8}
        required
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : "Simpan dan Masuk"}
      </Button>
    </form>
  );
}
