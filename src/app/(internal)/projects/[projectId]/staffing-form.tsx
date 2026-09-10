"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Alert, Button, Dialog, TextArea, TextField } from "@/components/ui";
import {
  type RequestStaffingFormState,
  requestStaffingAction,
} from "./actions";

const INITIAL: RequestStaffingFormState = { error: null };

export function RequestStaffingForm({ projectDbId }: { projectDbId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    requestStaffingAction,
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
        Ajukan kebutuhan programmer
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Ajukan kebutuhan programmer"
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
            label="Jabatan yang dibutuhkan"
            name="roleNeeded"
            required
            error={state.fields?.roleNeeded}
            hint="Contoh: Backend Developer."
          />

          <TextField
            label="Jumlah orang"
            name="headcount"
            required
            inputMode="numeric"
            error={state.fields?.headcount}
            hint="Bilangan bulat, minimal satu."
          />

          <TextField
            label="Tanggal dibutuhkan"
            name="neededBy"
            type="date"
            required
            error={state.fields?.neededBy}
          />

          <TextArea
            label="Kebutuhan teknis"
            name="technicalNeeds"
            required
            rows={3}
            error={state.fields?.technicalNeeds}
            hint="Stack atau keahlian yang harus ada di orang yang ditetapkan."
          />

          <TextArea
            label="Deliverable"
            name="deliverable"
            required
            rows={3}
            error={state.fields?.deliverable}
            hint="Hasil kerja yang diharapkan dari penugasan ini."
          />

          <Button type="submit" disabled={pending}>
            {pending ? "Mengajukan…" : "Ajukan ke CTO"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
