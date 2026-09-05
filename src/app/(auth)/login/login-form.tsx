"use client";

import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import { TextField } from "@/components/ui/text-field";
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

      <button
        type="submit"
        disabled={pending}
        className="rounded-card bg-plum-900 px-4 py-2 font-semibold text-white transition-colors hover:bg-plum-950 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Memeriksa…" : "Masuk"}
      </button>
    </form>
  );
}
