"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Alert, Button, TextArea } from "@/components/ui";
import { SUBMISSION_DECISION_BUTTONS } from "@/lib/finance/decision";
import { FINANCE_QUEUE_HREF } from "@/lib/finance/display";
import {
  type DecideSubmissionFormState,
  decideSubmissionAction,
} from "./actions";

const INITIAL: DecideSubmissionFormState = { error: null };

export function SubmissionDecisionForm({
  submissionId,
  holdingLabel,
}: {
  submissionId: string;
  holdingLabel: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    decideSubmissionAction,
    INITIAL,
  );

  useEffect(() => {
    if (!state.savedAt) return;
    if (state.leftQueue) {
      router.push(FINANCE_QUEUE_HREF);
      return;
    }
    router.refresh();
  }, [state.savedAt, state.leftQueue, router]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      autoComplete="off"
    >
      <input type="hidden" name="submissionId" value={submissionId} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <p className="text-sm">
        Langkah ini menunggu keputusan {holdingLabel}. Pengaju tidak memilih
        rantainya.
      </p>

      <TextArea
        label="Alasan penolakan"
        name="reason"
        rows={3}
        error={state.fields?.reason}
        hint="Wajib diisi jika menolak. Persetujuan tidak membutuhkan alasan."
      />

      <div className="flex flex-wrap gap-2">
        {SUBMISSION_DECISION_BUTTONS.map((button) => (
          <Button
            key={button.decision}
            type="submit"
            name="decision"
            value={button.decision}
            variant={button.variant}
            disabled={pending}
          >
            {pending ? "Mencatat…" : button.label}
          </Button>
        ))}
      </div>
    </form>
  );
}
