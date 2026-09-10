"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import {
  type ValidateReceiptFormState,
  validateReceiptAction,
} from "@/app/(internal)/finance/receipt-actions";
import { Alert, Button, TextArea } from "@/components/ui";

const INITIAL: ValidateReceiptFormState = { error: null };

export function ValidateReceiptForm({
  receiptId,
  warning,
}: {
  receiptId: string;
  warning: string | null;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    validateReceiptAction,
    INITIAL,
  );

  useEffect(() => {
    if (!state.savedAt) return;
    router.refresh();
  }, [state.savedAt, router]);

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3"
      autoComplete="off"
    >
      <input type="hidden" name="receiptId" value={receiptId} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}
      {warning ? <Alert tone="status">{warning}</Alert> : null}

      <TextArea
        label="Penyelesaian selisih"
        name="resolution"
        rows={2}
        error={state.fields?.resolution}
        hint="Wajib bila nominal kuitansi berbeda dari invoice."
      />

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : "Nyatakan valid"}
      </Button>
    </form>
  );
}
