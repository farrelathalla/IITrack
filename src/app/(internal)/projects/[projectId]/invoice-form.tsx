"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Alert, Button, Dialog, SelectField, TextArea } from "@/components/ui";
import { buildInvoiceDraft } from "@/lib/finance/invoice";
import type { InvoiceTerminOption } from "@/lib/finance/invoice-form";
import { formatDateId } from "@/lib/member/ui";
import { formatProjectValue } from "@/lib/project/hub-display";
import { type RequestInvoiceFormState, requestInvoiceAction } from "./actions";

const INITIAL: RequestInvoiceFormState = { error: null };

export function RequestInvoiceForm({
  project,
  termins,
}: {
  project: { projectId: string; name: string; clientName: string };
  termins: InvoiceTerminOption[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [terminId, setTerminId] = useState("");
  const [state, formAction, pending] = useActionState(
    requestInvoiceAction,
    INITIAL,
  );

  useEffect(() => {
    if (!state.savedAt) return;
    router.refresh();
    setOpen(false);
    setTerminId("");
  }, [state.savedAt, router]);

  const dipilih = termins.find((row) => row.id === terminId) ?? null;
  const pratinjau = useMemo(() => {
    if (!dipilih || dipilih.blockedReason) return null;
    const hasil = buildInvoiceDraft({
      project,
      termin: {
        sequence: dipilih.sequence,
        percentage: dipilih.percentage,
        amount: dipilih.amount,
        dueDate: new Date(dipilih.dueDateIso),
        status: dipilih.status,
      },
    });
    return hasil.ok ? hasil.draft : null;
  }, [dipilih, project]);

  const bisaDiajukan = termins.some((row) => row.blockedReason === null);

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Ajukan invoice
      </Button>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Ajukan invoice"
        className="w-[min(100%-2rem,36rem)]"
      >
        {bisaDiajukan ? (
          <form
            action={formAction}
            className="flex flex-col gap-4"
            autoComplete="off"
          >
            {state.error ? <Alert tone="danger">{state.error}</Alert> : null}

            <SelectField
              label="Termin"
              name="terminId"
              required
              value={terminId}
              onChange={(event) => setTerminId(event.target.value)}
              error={state.fields?.terminId}
              hint="Project ID, client, dan nominal terisi dari termin yang dipilih."
            >
              <option value="">Pilih termin</option>
              {termins.map((row) => (
                <option
                  key={row.id}
                  value={row.id}
                  disabled={row.blockedReason !== null}
                >
                  {`Termin ${row.sequence} · ${formatProjectValue(row.amount) ?? row.amount}`}
                  {row.blockedReason ? " (tidak bisa diajukan)" : ""}
                </option>
              ))}
            </SelectField>

            {pratinjau ? (
              <dl className="grid gap-3 rounded-card border border-line px-3 py-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500 text-xs">Nomor invoice</dt>
                  <dd className="angka">{pratinjau.number}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-xs">Project ID</dt>
                  <dd className="angka">{pratinjau.projectId}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-xs">Client</dt>
                  <dd>{pratinjau.clientName}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-xs">Nominal</dt>
                  <dd className="angka">
                    {formatProjectValue(pratinjau.amount) ?? pratinjau.amount}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-xs">Jatuh tempo</dt>
                  <dd className="angka">{formatDateId(pratinjau.dueDate)}</dd>
                </div>
              </dl>
            ) : null}

            <TextArea
              label="Keterangan"
              name="description"
              rows={3}
              hint="Opsional. Tidak mengubah nominal tagihan."
            />
            <TextArea label="Catatan" name="notes" rows={2} hint="Opsional." />

            <Button type="submit" disabled={pending || !pratinjau}>
              {pending ? "Mengajukan…" : "Ajukan invoice"}
            </Button>
          </form>
        ) : (
          <Alert tone="status">
            Tidak ada termin yang bisa diajukan sekarang. Yang sudah lunas atau
            masih menunggu keputusan tidak bisa ditagihkan lagi.
          </Alert>
        )}
      </Dialog>
    </>
  );
}
