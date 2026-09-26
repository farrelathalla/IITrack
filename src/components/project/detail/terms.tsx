"use client";

import { ChevronRight, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  saveTermsAction,
  termAction,
} from "@/app/(internal)/projects/[code]/actions";
import { labelTone, TERM_STATUS_TONE } from "@/components/project/tones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { TextField } from "@/components/ui/text-field";
import {
  availableTermActions,
  invoiceStatusLabel,
  isDownPayment,
  PAYMENT_FLOW_STEPS,
  paymentFlowIndex,
  paymentStatusLabel,
  receiptStatusLabel,
  stageOfTerm,
  sumPercentage,
  TERM_STATUS_LABELS,
  TERM_TRANSITIONS,
  type TermAction,
  type TermStep,
  termStatus,
} from "@/lib/finance/terms";
import { formatRupiah, HIDDEN } from "@/lib/money";
import { financePocOf, type TermSnapshot } from "@/lib/project/snapshot";
import { isStageUnlocked } from "@/lib/project/stages";
import { formatDate, toDateInput } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ErrorText, ExternalAnchor, FeedbackCard } from "./bits";
import { useProject, useRunner } from "./context";
import { RejectDialog } from "./submission-bar";

/** Stepper ringkas "Alur Pembayaran" seperti prototipe. */
export function PaymentFlow({ step }: { step: TermStep }) {
  const current = paymentFlowIndex(step);
  return (
    <div className="flex flex-wrap items-center gap-1">
      {PAYMENT_FLOW_STEPS.map((label, index) => (
        <div key={label} className="flex items-center gap-1">
          <span
            className={cn(
              "whitespace-nowrap rounded-full border px-2.5 py-1 font-medium text-[11px]",
              index < current || current === 7
                ? "border-success-line bg-success-bg text-success-text"
                : index === current
                  ? "border-plum-600 bg-plum-600 text-white"
                  : "border-line bg-surface text-faint",
            )}
          >
            {label}
          </span>
          {index < PAYMENT_FLOW_STEPS.length - 1 ? (
            <ChevronRight className="size-3 text-faint" />
          ) : null}
        </div>
      ))}
    </div>
  );
}

const URL_PROMPT: Partial<Record<TermAction, string>> = {
  REQUEST_INVOICE: "Tautan Invoice Request (opsional)",
  APPROVE_INVOICE: "Approved Invoice Link (opsional)",
  ADD_PROOF: "Tautan bukti transfer (opsional)",
  ISSUE_RECEIPT: "Official Receipt (opsional)",
};

export function termDueLabel(term: TermSnapshot): string {
  return term.dueDate ? formatDate(term.dueDate) : (term.dueNote ?? "—");
}

/**
 * Kartu satu termin: nominal, status, due date, status invoice, kwitansi,
 * finance owner, dan tombol sesuai jabatan (PRD bab 8.3, tab Finance).
 */
export function TermCard({ term }: { term: TermSnapshot }) {
  const { project, stages, can, amountsHidden, financeBackup } = useProject();
  const { run, pending, error } = useRunner();
  const [dialog, setDialog] = useState<TermAction | null>(null);
  const [url, setUrl] = useState("");
  const now = new Date();
  const status = termStatus(term, now);
  const finance = financePocOf(project);
  const stage = stageOfTerm(term.sequence, project.terms.length);
  const unlocked = isStageUnlocked(stages, stage);

  const roles = [
    ...(can["term.pm"] ? (["PM"] as const) : []),
    ...(can["term.finance"] ? (["FINANCE"] as const) : []),
  ];
  const actions = availableTermActions(term.step, roles);
  const blockedReason = !finance
    ? "Finance POC belum ditunjuk. Menunggu CFO/VCFO."
    : !unlocked
      ? `Minta Invoice aktif setelah Stage ${stage} terbuka.`
      : null;

  function trigger(action: TermAction) {
    const rule = TERM_TRANSITIONS[action];
    if (rule.requiresFeedback || URL_PROMPT[action]) {
      setUrl("");
      setDialog(action);
      return;
    }
    run(() => termAction(project.code, term.id, action));
  }

  const references = [
    ["Invoice Request", term.invoiceRequestUrl],
    ["Approved Invoice", term.approvedInvoiceUrl],
    ["Bukti Transfer", term.transferProofUrl],
    ["Official Receipt", term.receiptUrl],
  ].filter(([, href]) => href) as [string, string][];

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-white">
      <div
        className={cn(
          "flex items-center justify-between gap-3 px-4 py-3",
          status === "PAID" ? "bg-success-bg" : "bg-surface",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-7 items-center justify-center rounded-full font-bold text-xs",
              status === "PAID"
                ? "bg-success-text text-white"
                : "bg-line text-subtle",
            )}
          >
            {term.sequence}
          </span>
          <div>
            <p className="font-semibold text-ink text-sm">{term.name}</p>
            <p className="text-[11px] text-subtle">
              {term.percentage}% dari total nilai kontrak
              {isDownPayment(term.sequence)
                ? " · Stage 5"
                : ` · Stage ${stage}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <p className="font-bold text-ink text-sm tabular-nums">
            {amountsHidden ? HIDDEN : formatRupiah(term.amount)}
          </p>
          <Badge tone={TERM_STATUS_TONE[status]} dot>
            {TERM_STATUS_LABELS[status]}
          </Badge>
        </div>
      </div>

      <div className="grid grid-cols-5 gap-3 px-4 py-3 text-xs">
        {[
          ["Due Date", termDueLabel(term)],
          ["Status Invoice", invoiceStatusLabel(term.step)],
          ["Pembayaran", paymentStatusLabel(term.step)],
          ["Kwitansi", receiptStatusLabel(term.step)],
        ].map(([label, value], index) => (
          <div key={label}>
            <p className="text-[10px] text-subtle uppercase tracking-wider">
              {label}
            </p>
            {index === 0 ? (
              <p className="mt-0.5 font-medium text-ink">{value}</p>
            ) : (
              <Badge tone={labelTone(value)} className="mt-0.5">
                {value}
              </Badge>
            )}
          </div>
        ))}
        <div>
          <p className="text-[10px] text-subtle uppercase tracking-wider">
            Finance Owner
          </p>
          <p className="mt-0.5 font-medium text-ink">{finance?.name ?? "—"}</p>
        </div>
      </div>

      {term.step !== "NOT_STARTED" || term.feedback ? (
        <div className="space-y-2 border-surface border-t px-4 py-3">
          {term.step !== "NOT_STARTED" ? (
            <PaymentFlow step={term.step} />
          ) : null}
          {term.feedback ? (
            <FeedbackCard
              feedback={term.feedback}
              reviewer={finance?.name ?? "Finance POC"}
              title="Ditolak Finance"
            />
          ) : null}
          {references.length > 0 ? (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
              {references.map(([label, href]) => (
                <ExternalAnchor key={label} href={href}>
                  {label}
                </ExternalAnchor>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {actions.length > 0 && term.step !== "DONE" ? (
        <div className="space-y-2 border-surface border-t px-4 py-3">
          <ErrorText error={error} />
          <div className="flex flex-wrap items-center gap-2">
            {actions.map((action) => {
              const rule = TERM_TRANSITIONS[action];
              const disabled =
                pending ||
                (action === "REQUEST_INVOICE" && Boolean(blockedReason));
              return (
                <Button
                  key={action}
                  size="sm"
                  variant={
                    rule.requiresFeedback
                      ? "danger"
                      : action === "COMPLETE" || action === "APPROVE_PAYMENT"
                        ? "success"
                        : rule.actors.includes("PM") &&
                            !rule.actors.includes("FINANCE")
                          ? "primary"
                          : "secondary"
                  }
                  disabled={disabled}
                  onClick={() => trigger(action)}
                >
                  {rule.label}
                </Button>
              );
            })}
            {actions.includes("REQUEST_INVOICE") && blockedReason ? (
              <span className="text-subtle text-xs">{blockedReason}</span>
            ) : null}
            {financeBackup &&
            roles.includes("FINANCE") &&
            actions.some((a) =>
              TERM_TRANSITIONS[a].actors.includes("FINANCE"),
            ) ? (
              <span className="text-[11px] text-subtle">
                Tercatat atas namamu sebagai cadangan Finance POC.
              </span>
            ) : null}
          </div>
        </div>
      ) : null}

      {dialog && TERM_TRANSITIONS[dialog].requiresFeedback ? (
        <RejectDialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={`${TERM_TRANSITIONS[dialog].label} — ${term.name}`}
          pending={pending}
          error={error}
          onReject={(feedback) =>
            run(
              () => termAction(project.code, term.id, dialog, { feedback }),
              () => setDialog(null),
            )
          }
        />
      ) : null}
      {dialog && URL_PROMPT[dialog] ? (
        <Dialog
          open
          onOpenChange={(open) => !open && setDialog(null)}
          title={`${TERM_TRANSITIONS[dialog].label} — ${term.name}`}
        >
          <div className="space-y-3">
            <ErrorText error={error} />
            <TextField
              label={URL_PROMPT[dialog]}
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              hint="Referensi berupa tautan dan tidak wajib; yang dicatat adalah statusnya."
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setDialog(null)}>
                Batal
              </Button>
              <Button
                disabled={pending}
                onClick={() =>
                  run(
                    () => termAction(project.code, term.id, dialog, { url }),
                    () => setDialog(null),
                  )
                }
              >
                {TERM_TRANSITIONS[dialog].label}
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </div>
  );
}

interface Row {
  name: string;
  percentage: string;
  amount: string;
  dueDate: string;
  dueNote: string;
}

function toRows(terms: TermSnapshot[]): Row[] {
  if (terms.length === 0) {
    return [
      {
        name: "Termin 1 — DP",
        percentage: "30",
        amount: "",
        dueDate: "",
        dueNote: "",
      },
      {
        name: "Termin 2",
        percentage: "40",
        amount: "",
        dueDate: "",
        dueNote: "",
      },
      {
        name: "Termin 3 — Final",
        percentage: "30",
        amount: "",
        dueDate: "",
        dueNote: "Setelah BAST",
      },
    ];
  }
  return terms.map((t) => ({
    name: t.name,
    percentage: String(t.percentage),
    amount: String(t.amount),
    dueDate: toDateInput(t.dueDate),
    dueNote: t.dueNote ?? "",
  }));
}

/**
 * Editor termin pembayaran: nama, persentase, nominal, dan due date (boleh
 * teks). Total persentase harus 100% dan termin pertama adalah DP (PRD 4.6).
 */
export function TermsEditor({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { project } = useProject();
  const [rows, setRows] = useState<Row[]>(() => toRows(project.terms));
  const [total, setTotal] = useState(() =>
    String(project.terms.reduce((s, t) => s + t.amount, 0) || ""),
  );
  const { run, pending, error } = useRunner();
  const pct = sumPercentage(
    rows.map((r) => ({ percentage: Number(r.percentage) || 0 })),
  );

  const update = (index: number, patch: Partial<Row>) =>
    setRows((current) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );

  function fillAmounts() {
    const value = Number(total);
    if (!value) return;
    setRows((current) =>
      current.map((row) => ({
        ...row,
        amount: String(
          Math.round((value * (Number(row.percentage) || 0)) / 100),
        ),
      })),
    );
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title="Termin Pembayaran"
      className="w-[min(100%-2rem,56rem)]"
    >
      <div className="space-y-3">
        <ErrorText error={error} />
        <div className="flex items-end gap-2">
          <TextField
            label="Total nilai kontrak (bantu hitung nominal)"
            type="number"
            min={0}
            value={total}
            onChange={(e) => setTotal(e.target.value)}
            className="w-56"
          />
          <Button
            variant="secondary"
            size="sm"
            onClick={fillAmounts}
            className="mb-0.5"
          >
            Hitung nominal dari persentase
          </Button>
        </div>
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-[10px] text-muted uppercase tracking-wider">
              <th className="pb-1">Nama termin</th>
              <th className="w-20 pb-1">%</th>
              <th className="w-36 pb-1">Nominal (Rp)</th>
              <th className="w-36 pb-1">Due date</th>
              <th className="w-36 pb-1">atau keterangan</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: baris termin memang diurutkan menurut posisinya
              <tr key={index}>
                <td className="py-1 pr-2">
                  <input
                    aria-label="Nama termin"
                    value={row.name}
                    onChange={(e) => update(index, { name: e.target.value })}
                    className={cn(FIELD_CONTROL, "py-1.5 text-xs")}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label="Persentase"
                    type="number"
                    min={0}
                    max={100}
                    value={row.percentage}
                    onChange={(e) =>
                      update(index, { percentage: e.target.value })
                    }
                    className={cn(FIELD_CONTROL, "py-1.5 text-xs")}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label="Nominal"
                    type="number"
                    min={0}
                    value={row.amount}
                    onChange={(e) => update(index, { amount: e.target.value })}
                    className={cn(FIELD_CONTROL, "py-1.5 text-xs")}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label="Due date"
                    type="date"
                    value={row.dueDate}
                    onChange={(e) => update(index, { dueDate: e.target.value })}
                    className={cn(FIELD_CONTROL, "py-1.5 text-xs")}
                  />
                </td>
                <td className="py-1 pr-2">
                  <input
                    aria-label="Keterangan due date"
                    value={row.dueNote}
                    placeholder="Setelah BAST"
                    onChange={(e) => update(index, { dueNote: e.target.value })}
                    className={cn(FIELD_CONTROL, "py-1.5 text-xs")}
                  />
                </td>
                <td className="py-1">
                  <button
                    type="button"
                    aria-label="Hapus termin"
                    disabled={rows.length === 1}
                    onClick={() =>
                      setRows((r) => r.filter((_, i) => i !== index))
                    }
                    className="rounded p-1 text-subtle hover:bg-danger-bg hover:text-danger-text disabled:opacity-30"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setRows((r) => [
                ...r,
                {
                  name: `Termin ${r.length + 1}`,
                  percentage: "",
                  amount: "",
                  dueDate: "",
                  dueNote: "",
                },
              ])
            }
          >
            <Plus className="size-3.5" />
            Tambah termin
          </Button>
          <p
            className={cn(
              "font-semibold text-xs",
              pct === 100 ? "text-success-text" : "text-danger-text",
            )}
          >
            Total persentase: {pct}% {pct === 100 ? "✓" : "(harus 100%)"}
          </p>
        </div>
        <p className="text-[11px] text-subtle">
          Termin pertama selalu DP (Stage 5), termin terakhir adalah termin
          final (Stage 7), dan termin di antaranya ditagih di Stage 6.
        </p>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            disabled={pending}
            onClick={() =>
              run(
                () =>
                  saveTermsAction(
                    project.code,
                    rows.map((row) => ({
                      name: row.name,
                      percentage: Number(row.percentage) || 0,
                      amount: Number(row.amount) || 0,
                      dueDate: row.dueDate,
                      dueNote: row.dueNote,
                    })),
                  ),
                () => onOpenChange(false),
              )
            }
          >
            {pending ? "Menyimpan…" : "Simpan Termin"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
