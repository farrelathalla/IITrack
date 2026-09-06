"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { Alert, Button, Dialog, SelectField, TextArea } from "@/components/ui";
import {
  type StageDefinition,
  stageTargetsForSelect,
  suggestedStageTarget,
} from "@/lib/project/stages";
import { type ChangeStageFormState, changeProjectStageAction } from "./actions";

const INITIAL: ChangeStageFormState = { error: null };

export function ChangeStageForm({
  projectDbId,
  currentStageKey,
  stages,
}: {
  projectDbId: string;
  currentStageKey: string | null;
  stages: readonly StageDefinition[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    changeProjectStageAction,
    INITIAL,
  );

  const targets = stageTargetsForSelect(stages, currentStageKey);
  const suggested = suggestedStageTarget(stages, currentStageKey);

  useEffect(() => {
    if (!state.savedAt) return;
    router.refresh();
    setOpen(false);
  }, [state.savedAt, router]);

  if (targets.length === 0) {
    return (
      <p className="text-slate-500 text-sm">
        Belum ada tahap tujuan di katalog. Daftar resminya masih ditunggu dari
        COO (DEP-04).
      </p>
    );
  }

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Ajukan perpindahan tahap
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Ajukan perpindahan tahap"
      >
        <form
          action={formAction}
          className="flex flex-col gap-4"
          autoComplete="off"
        >
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

          <input type="hidden" name="projectDbId" value={projectDbId} />

          <SelectField
            label="Tahap tujuan"
            name="toStage"
            required
            defaultValue={suggested?.key}
            hint="Hanya tahap yang sudah ada di katalog. Sembilan nama tengah menunggu DEP-04."
          >
            {targets.map((stage) => (
              <option key={stage.key} value={stage.key}>
                {stage.order}. {stage.label}
              </option>
            ))}
          </SelectField>

          <TextArea
            label="Catatan (opsional)"
            name="note"
            rows={3}
            hint="Masuk ke riwayat tahap dan jejak aktivitas."
          />

          <Button type="submit" disabled={pending}>
            {pending ? "Memindahkan…" : "Pindahkan tahap"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
