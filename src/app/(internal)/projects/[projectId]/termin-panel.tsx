import Link from "next/link";
import {
  Alert,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import {
  FINANCE_QUEUE_HREF,
  financeApprovalLabel,
  financeSubmissionHref,
} from "@/lib/finance/display";
import type { InvoiceTerminOption } from "@/lib/finance/invoice-form";
import { invoiceBlockedReason } from "@/lib/finance/invoice-form";
import { formatProjectValue } from "@/lib/project/hub-display";
import { toDateInputValue } from "@/lib/termin/live";
import { RequestInvoiceForm } from "./invoice-form";
import { TerminSchemeForm } from "./termin-form";

type TerminRow = {
  id: string;
  sequence: number;
  percentage: string;
  amount: string;
  dueDate: Date;
  status: string;
};

type InvoiceRow = {
  id: string;
  number: string;
  terminSequence: number;
  amount: string;
  submissionId: string;
  submissionStatus: "PENDING" | "APPROVED" | "REJECTED";
  currentStepLabel: string | null;
};

function formatDueDate(value: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function statusLabel(status: string): string {
  return status === "PAID" ? "Lunas" : "Belum lunas";
}

export function TerminPanel({
  projectDbId,
  project,
  schemeValue,
  displayValue,
  termins,
  invoices,
  canEdit,
  canRequestInvoice,
  canOpenFinanceQueue,
}: {
  projectDbId: string;
  project: { projectId: string; name: string; clientName: string };
  schemeValue: string | null;
  displayValue: string | null;
  termins: TerminRow[];
  invoices: InvoiceRow[];
  canEdit: boolean;
  canRequestInvoice: boolean;
  canOpenFinanceQueue: boolean;
}) {
  const nilaiTampil = formatProjectValue(
    displayValue ?? (canEdit ? schemeValue : null),
  );
  const adaYangLunas = termins.some((row) => row.status === "PAID");
  const nilaiAda = schemeValue !== null && schemeValue !== "";
  const invoiceOptions: InvoiceTerminOption[] = termins.map((row) => ({
    id: row.id,
    sequence: row.sequence,
    percentage: row.percentage,
    amount: row.amount,
    dueDateIso: row.dueDate.toISOString(),
    status: row.status === "PAID" ? "PAID" : "UNPAID",
    blockedReason: invoiceBlockedReason(
      invoices.map((invoice) => ({
        terminSequence: invoice.terminSequence,
        submissionStatus: invoice.submissionStatus,
        currentStepLabel: invoice.currentStepLabel,
      })),
      row.sequence,
      row.status,
    ),
  }));

  return (
    <section
      id="termin"
      className="flex flex-col gap-3 rounded-card border border-line bg-white p-5"
    >
      <h2 className="text-base">Termin & pembayaran</h2>
      {nilaiTampil ? (
        <p className="text-sm">
          Nilai project:{" "}
          <span className="angka font-medium">{nilaiTampil}</span>
        </p>
      ) : null}

      {!nilaiAda ? (
        <Alert tone="status">
          Nilai project belum diisi, jadi skema termin belum bisa dihitung
          maupun disimpan.
        </Alert>
      ) : null}

      {adaYangLunas ? (
        <Alert tone="status">
          Ada termin yang sudah lunas, jadi jadwal tidak bisa disusun ulang dari
          sini. Perubahan setelah pelunasan mengikuti proses kuitansi.
        </Alert>
      ) : null}

      {termins.length > 0 && (!canEdit || adaYangLunas || !nilaiAda) ? (
        <TerminTable termins={termins} />
      ) : null}

      {termins.length === 0 && !canEdit ? (
        <p className="text-slate-500 text-sm">Belum ada jadwal termin.</p>
      ) : null}

      {canEdit && nilaiAda && !adaYangLunas ? (
        <TerminSchemeForm
          projectDbId={projectDbId}
          projectValue={schemeValue ?? ""}
          initialRows={
            termins.length >= 2
              ? termins.map((row) => ({
                  id: String(row.sequence),
                  percentage: row.percentage,
                  amount: row.amount,
                  dueDate: toDateInputValue(row.dueDate),
                }))
              : []
          }
        />
      ) : null}

      <div className="flex flex-col gap-3 border-line border-t pt-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-medium text-plum-900 text-sm">Invoice</h3>
          <div className="flex flex-wrap items-center gap-2">
            {canOpenFinanceQueue ? (
              <Link
                href={FINANCE_QUEUE_HREF}
                className="text-slate-500 text-xs underline-offset-4 hover:text-plum-900 hover:underline"
              >
                Buka antrean Finance
              </Link>
            ) : null}
            {canRequestInvoice && termins.length > 0 ? (
              <RequestInvoiceForm project={project} termins={invoiceOptions} />
            ) : null}
          </div>
        </div>

        {invoices.length === 0 ? (
          <p className="text-slate-500 text-sm">
            Belum ada pengajuan invoice pada project ini.
          </p>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {invoices.map((row) => (
              <li
                key={row.id}
                className="flex flex-col gap-1 rounded-card border border-line px-3 py-2"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {canOpenFinanceQueue ? (
                    <Link
                      href={financeSubmissionHref(row.submissionId)}
                      className="angka font-medium text-plum-900 underline-offset-4 hover:underline"
                    >
                      {row.number}
                    </Link>
                  ) : (
                    <span className="angka font-medium">{row.number}</span>
                  )}
                  <StatusBadge status={row.submissionStatus}>
                    {financeApprovalLabel(row.submissionStatus)}
                  </StatusBadge>
                </div>
                <p className="text-slate-500 text-xs">
                  Termin {row.terminSequence}
                  {" · "}
                  {formatProjectValue(row.amount) ?? row.amount}
                  {row.currentStepLabel
                    ? ` · menunggu ${row.currentStepLabel}`
                    : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function TerminTable({ termins }: { termins: TerminRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>%</TableHead>
          <TableHead>Nominal</TableHead>
          <TableHead>Jatuh tempo</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {termins.map((row) => (
          <TableRow key={row.sequence}>
            <TableCell className="angka">{row.sequence}</TableCell>
            <TableCell className="angka">{row.percentage}</TableCell>
            <TableCell className="angka">
              {formatProjectValue(row.amount) ?? row.amount}
            </TableCell>
            <TableCell className="angka">
              {formatDueDate(row.dueDate)}
            </TableCell>
            <TableCell>
              <StatusBadge status={row.status}>
                {statusLabel(row.status)}
              </StatusBadge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
