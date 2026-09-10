"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef } from "react";
import { Alert, Button, TextArea, TextField } from "@/components/ui";
import { type ClientFormState, createClientAction } from "./actions";

const INITIAL: ClientFormState = { error: null };

export function AddClientForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(
    createClientAction,
    INITIAL,
  );

  useEffect(() => {
    if (!state.savedAt) return;
    formRef.current?.reset();
    router.refresh();
  }, [state.savedAt, router]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="flex flex-col gap-4"
      autoComplete="off"
    >
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <TextField
        label="Nama client"
        name="name"
        required
        autoComplete="organization"
        hint="Wajib. Nama ini yang dipilih saat mendaftarkan project."
      />

      <TextField
        label="Kontak (opsional)"
        name="contact"
        autoComplete="off"
        hint="Email atau nomor yang dipakai Operational menghubungi client."
      />

      <TextArea
        label="Alamat (opsional)"
        name="address"
        rows={3}
        hint="Boleh dikosongkan."
      />

      <TextField
        label="NPWP (opsional)"
        name="npwp"
        inputMode="numeric"
        autoComplete="off"
        hint="15 atau 16 digit. Titik dan strip boleh, huruf tidak."
      />

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : "Tambah client"}
      </Button>
    </form>
  );
}
