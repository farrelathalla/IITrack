"use client";

import { useActionState } from "react";
import { Alert, Button, TextField } from "@/components/ui";
import { type LoginState, loginAction } from "./actions";

const INITIAL: LoginState = { error: null };

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/*
       * Galat tingkat halaman untuk penolakan dari server, dibedakan dari galat
       * per kolom (Design Brief bab 5).
       */}
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <TextField
        label="Email"
        type="email"
        name="email"
        autoComplete="email"
        required
      />

      <TextField
        label="Kata sandi"
        type="password"
        name="password"
        autoComplete="current-password"
        required
      />

      <Button type="submit" disabled={pending}>
        {pending ? "Memeriksa…" : "Masuk"}
      </Button>
    </form>
  );
}
