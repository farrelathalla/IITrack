"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Alert, Button, TextField } from "@/components/ui";
import { type RegisterFormState, registerProjectAction } from "./actions";

const INITIAL: RegisterFormState = { error: null };

/**
 * Formulir pendaftaran project (F05-T04).
 *
 * Setelah berhasil, nomor Project ID ditampilkan besar — itu deliverable utama
 * task ini, bukan sekadar toast yang cepat hilang.
 */
export function RegisterProjectForm({
  defaultPeriod = "2627",
}: {
  defaultPeriod?: string;
}) {
  const [state, formAction, pending] = useActionState(
    registerProjectAction,
    INITIAL,
  );

  if (state.projectId) {
    return (
      <div className="flex flex-col gap-4">
        <Alert tone="success">
          Project berhasil didaftarkan. Nomor resminya sudah terbit dan tidak
          akan didaur ulang.
        </Alert>

        <div className="rounded-card border border-plum-400/30 bg-plum-50 px-5 py-6 text-center">
          <p className="text-slate-500 text-xs tracking-wide">Project ID</p>
          <p className="angka mt-1 font-semibold text-3xl text-plum-900">
            {state.projectId}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link
            href="/projects/baru"
            className="inline-flex items-center justify-center rounded-card border border-line bg-white px-4 py-2 font-semibold text-plum-900 hover:bg-surface"
          >
            Daftarkan project lain
          </Link>
          <Link
            href="/beranda"
            className="inline-flex items-center justify-center px-2 py-2 font-semibold text-slate-500 underline-offset-4 hover:text-plum-900 hover:underline"
          >
            Kembali ke beranda
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

      <TextField
        label="Nama project"
        name="name"
        required
        autoComplete="off"
        error={state.fields?.name}
      />

      <TextField
        label="Nama client"
        name="clientName"
        required
        autoComplete="organization"
        error={state.fields?.clientName}
        hint="Sementara teks bebas; master data client (F06) menyusul."
      />

      <TextField
        label="Periode (empat digit)"
        name="period"
        required
        defaultValue={defaultPeriod}
        inputMode="numeric"
        pattern="\d{4}"
        maxLength={4}
        error={state.fields?.period}
        hint="Contoh 2627 untuk kepengurusan 2026/2027. Masuk ke nomor IIT-2627-NNN."
      />

      <TextField
        label="Nilai project (opsional)"
        name="value"
        inputMode="decimal"
        error={state.fields?.value}
        hint="Dalam rupiah, tanpa pemisah ribuan. Boleh dikosongkan."
      />

      <Button type="submit" disabled={pending}>
        {pending ? "Menerbitkan nomor…" : "Daftarkan project"}
      </Button>
    </form>
  );
}
