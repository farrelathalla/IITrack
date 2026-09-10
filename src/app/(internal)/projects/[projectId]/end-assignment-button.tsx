"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Alert, Button } from "@/components/ui";
import { type EndAssignmentFormState, endAssignmentAction } from "./actions";

const INITIAL: EndAssignmentFormState = { error: null };

export function EndAssignmentButton({
  assignmentId,
}: {
  assignmentId: string;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    endAssignmentAction,
    INITIAL,
  );

  useEffect(() => {
    if (!state.savedAt) return;
    router.refresh();
  }, [state.savedAt, router]);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="assignmentId" value={assignmentId} />
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      <Button type="submit" variant="secondary" disabled={pending}>
        {pending ? "Mengakhiri…" : "Akhiri"}
      </Button>
    </form>
  );
}
