"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Alert, Button, Dialog, TextField } from "@/components/ui";
import { type AddReferenceFormState, addReferenceAction } from "./actions";

const INITIAL: AddReferenceFormState = { error: null };

export function AddReferenceForm({ projectDbId }: { projectDbId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    addReferenceAction,
    INITIAL,
  );

  useEffect(() => {
    if (!state.savedAt) return;
    router.refresh();
    setOpen(false);
  }, [state.savedAt, router]);

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Tambah tautan
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Tambah tautan rujukan"
        className="w-[min(100%-2rem,36rem)]"
      >
        <form
          action={formAction}
          className="flex flex-col gap-4"
          autoComplete="off"
        >
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

          <input type="hidden" name="projectDbId" value={projectDbId} />

          <TextField
            label="Alamat tautan"
            name="url"
            type="url"
            required
            error={state.fields?.url}
            hint="https Drive, Notion, GitHub, atau tautan lain. Bukan unggah berkas."
          />

          <TextField
            label="Nama tautan"
            name="label"
            required
            error={state.fields?.label}
            hint="Nama yang tampil di Project Hub."
          />

          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan tautan"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
