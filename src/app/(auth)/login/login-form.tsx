"use client";

import { useActionState } from "react";
import { type LoginState, loginAction } from "./actions";

const INITIAL: LoginState = { error: null };

const FIELD =
  "rounded-card border border-line bg-white px-3 py-2 text-ink outline-none focus:border-plum-400 focus:ring-2 focus:ring-plum-400/25";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {/*
       * Galat tingkat halaman untuk penolakan dari server, dibedakan dari galat
       * per kolom (Design Brief bab 5).
       */}
      {state.error ? (
        <p
          role="alert"
          className="rounded-card border border-danger-text/20 bg-danger-bg px-3 py-2 text-danger-text"
        >
          {state.error}
        </p>
      ) : null}

      <label className="flex flex-col gap-1.5">
        <span className="font-medium text-plum-900">Email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="font-medium text-plum-900">Kata sandi</span>
        <input
          type="password"
          name="password"
          autoComplete="current-password"
          required
          className={FIELD}
        />
      </label>

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
