"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Alert, Button, FIELD_CONTROL, StatusBadge } from "@/components/ui";
import { liveTerminFeedback } from "@/lib/termin/live";
import { cn } from "@/lib/utils";
import { type SaveTerminFormState, saveTerminSchemeAction } from "./actions";

export type TerminFormRow = {
  id: string;
  percentage: string;
  amount: string;
  dueDate: string;
};

const INITIAL: SaveTerminFormState = { error: null };

function emptyRow(): TerminFormRow {
  return {
    id:
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `row-${Date.now()}-${Math.random()}`,
    percentage: "",
    amount: "",
    dueDate: "",
  };
}

export function TerminSchemeForm({
  projectDbId,
  projectValue,
  initialRows,
}: {
  projectDbId: string;
  projectValue: string;
  initialRows: TerminFormRow[];
}) {
  const router = useRouter();
  const [rows, setRows] = useState<TerminFormRow[]>(
    initialRows.length >= 2 ? initialRows : [emptyRow(), emptyRow()],
  );
  const [state, formAction, pending] = useActionState(
    saveTerminSchemeAction,
    INITIAL,
  );

  const live = useMemo(
    () => liveTerminFeedback({ projectValue, drafts: rows }),
    [projectValue, rows],
  );

  useEffect(() => {
    if (!state.savedAt) return;
    router.refresh();
  }, [state.savedAt, router]);

  function updateRow(id: string, patch: Partial<TerminFormRow>) {
    setRows((current) =>
      current.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-4"
      autoComplete="off"
    >
      <input type="hidden" name="projectDbId" value={projectDbId} />
      <input type="hidden" name="rowCount" value={rows.length} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <div className="flex flex-col gap-2 text-sm">
        <p className="flex flex-wrap items-center justify-between gap-2">
          <span>Jumlah persentase</span>
          <span className="flex items-center gap-2">
            <span className="angka font-medium">{live.total.display}</span>
            <StatusBadge tone={live.total.ok ? "success" : "danger"}>
              {live.total.ok ? "lengkap" : "belum 100"}
            </StatusBadge>
          </span>
        </p>
        <p className="flex flex-wrap items-center justify-between gap-2">
          <span>Uang muka (termin 1)</span>
          <span className="flex items-center gap-2">
            <span className="angka font-medium">{live.dp.display}</span>
            <StatusBadge tone={live.dp.ok ? "success" : "danger"}>
              {live.dp.ok ? "25–50%" : "di luar 25–50%"}
            </StatusBadge>
          </span>
        </p>
      </div>

      <ol className="flex flex-col gap-3">
        {rows.map((row, index) => (
          <li
            key={row.id}
            className="flex flex-col gap-2 rounded-card border border-line p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="font-medium text-plum-900 text-sm">
                Termin <span className="angka">{index + 1}</span>
                {index === 0 ? (
                  <span className="ml-2 font-normal text-slate-500 text-xs">
                    uang muka
                  </span>
                ) : null}
              </p>
              {rows.length > 2 ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="px-2 py-1 text-xs"
                  onClick={() =>
                    setRows((current) =>
                      current.filter((item) => item.id !== row.id),
                    )
                  }
                >
                  Hapus
                </Button>
              ) : null}
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <label className="flex flex-col gap-1">
                <span className="text-slate-500 text-xs">Persentase</span>
                <input
                  name={`percentage-${index}`}
                  value={row.percentage}
                  onChange={(event) =>
                    updateRow(row.id, { percentage: event.target.value })
                  }
                  inputMode="decimal"
                  className={cn(FIELD_CONTROL, "angka")}
                  aria-label={`Persentase termin ${index + 1}`}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-slate-500 text-xs">Nominal (Rp)</span>
                <input
                  name={`amount-${index}`}
                  value={row.amount}
                  onChange={(event) =>
                    updateRow(row.id, { amount: event.target.value })
                  }
                  inputMode="decimal"
                  className={cn(FIELD_CONTROL, "angka")}
                  aria-label={`Nominal termin ${index + 1}`}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-slate-500 text-xs">Jatuh tempo</span>
                <input
                  name={`dueDate-${index}`}
                  type="date"
                  required
                  value={row.dueDate}
                  onChange={(event) =>
                    updateRow(row.id, { dueDate: event.target.value })
                  }
                  className={cn(FIELD_CONTROL, "angka")}
                  aria-label={`Jatuh tempo termin ${index + 1}`}
                />
              </label>
            </div>
            <p className="text-slate-500 text-xs">
              Isi persentase atau nominal. Yang kosong dihitung dari nilai
              project.
            </p>
          </li>
        ))}
      </ol>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="secondary"
          onClick={() => setRows((current) => [...current, emptyRow()])}
        >
          + Termin
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Menyimpan…" : "Simpan skema termin"}
        </Button>
      </div>
    </form>
  );
}
