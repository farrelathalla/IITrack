"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import {
  type RecordTransferProofFormState,
  recordTransferProofAction,
} from "@/app/(internal)/finance/receipt-actions";
import { Alert, Button, Dialog, TextArea, TextField } from "@/components/ui";
import { formatDocumentNumber } from "@/lib/document/numbering";
import { compareReceiptAmount } from "@/lib/finance/receipt";
import { formatProjectValue } from "@/lib/project/hub-display";

const INITIAL: RecordTransferProofFormState = { error: null };

export function RecordTransferProofForm({
  invoice,
}: {
  invoice: {
    id: string;
    number: string;
    amount: string;
    projectId: string;
    clientName: string;
  };
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState(invoice.amount);
  const [state, formAction, pending] = useActionState(
    recordTransferProofAction,
    INITIAL,
  );

  useEffect(() => {
    if (!state.savedAt) return;
    router.refresh();
    setOpen(false);
  }, [state.savedAt, router]);

  const nomor = useMemo(() => {
    try {
      return formatDocumentNumber("RECEIPT", invoice.projectId);
    } catch {
      return null;
    }
  }, [invoice.projectId]);

  const peringatan = useMemo(() => {
    const hasil = compareReceiptAmount(invoice.amount, amount);
    return hasil.readable ? hasil.warning : null;
  }, [amount, invoice.amount]);

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Catat bukti transfer
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Catat bukti transfer"
        className="w-[min(100%-2rem,36rem)]"
      >
        <form
          action={formAction}
          className="flex flex-col gap-4"
          autoComplete="off"
        >
          <input type="hidden" name="invoiceId" value={invoice.id} />

          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

          <dl className="grid gap-3 rounded-card border border-line px-3 py-3 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500 text-xs">Nomor kuitansi</dt>
              <dd className="angka">{nomor ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs">Invoice</dt>
              <dd className="angka">{invoice.number}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs">Project ID</dt>
              <dd className="angka">{invoice.projectId}</dd>
            </div>
            <div>
              <dt className="text-slate-500 text-xs">Client</dt>
              <dd>{invoice.clientName}</dd>
            </div>
          </dl>

          <TextField
            label="Nominal diterima"
            name="amount"
            inputMode="decimal"
            required
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
            error={state.fields?.amount}
            hint={`Invoice: ${formatProjectValue(invoice.amount) ?? invoice.amount}`}
          />

          {peringatan ? <Alert tone="status">{peringatan}</Alert> : null}

          <TextField
            label="Tanggal transfer"
            name="paidAt"
            type="date"
            required
            error={state.fields?.paidAt}
          />
          <TextField
            label="Tautan bukti transfer"
            name="proofUrl"
            type="url"
            required
            placeholder="https://drive.google.com/..."
            error={state.fields?.proofUrl}
            hint="Pakai alamat https. IITrack tidak menyimpan berkasnya."
          />
          <TextArea
            label="Catatan bukti"
            name="proofNote"
            rows={2}
            hint="Opsional."
          />

          <Button type="submit" disabled={pending}>
            {pending ? "Mencatat…" : "Catat kuitansi"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
