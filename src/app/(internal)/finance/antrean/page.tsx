import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
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
  canSeeFinanceQueue,
  FINANCE_QUEUE_COLUMNS,
  filterFinanceQueueItems,
  financeApprovalLabel,
  financeHoldingDisplay,
  financePaymentLabel,
  financeSubmissionHref,
  parseFinanceQueueSearchParams,
} from "@/lib/finance/display";
import { formatDateId } from "@/lib/member/ui";
import { formatProjectValue } from "@/lib/project/hub-display";
import { formatWorkingDuration } from "@/lib/sla/display";
import { getAuthenticatedSession } from "@/server/auth/session";
import { readFinanceQueue } from "@/server/finance/queue";
import { FinanceQueueFilters } from "./queue-filters";

export const metadata: Metadata = {
  title: "Antrean Finance",
};

export default async function FinanceQueuePage({
  searchParams,
}: {
  searchParams: Promise<{ jenis?: string; status?: string }>;
}) {
  const session = await getAuthenticatedSession();
  if (!session) notFound();

  const now = new Date();
  if (!canSeeFinanceQueue(session.actor, now)) notFound();

  const query = await searchParams;
  const filters = parseFinanceQueueSearchParams(query);

  const antrean = await readFinanceQueue(session.actor, now);
  if (!antrean.ok) {
    return <Alert tone="danger">{antrean.reason}</Alert>;
  }

  const rows = filterFinanceQueueItems(antrean.items, filters);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-slate-500 text-xs">
          <Link href="/beranda" className="underline-offset-4 hover:underline">
            Beranda
          </Link>
          {" / "}
          Antrean Finance
        </p>
        <h1 className="text-xl">Antrean Finance</h1>
        <p className="max-w-prose text-slate-500">
          Pengajuan tertua di atas. Lama menunggu dihitung dalam jam kerja, sama
          seperti SLA penugasan PM. Baris membuka rincian; keputusan setuju atau
          tolak ada di halaman itu, bukan di tabel ini.
        </p>
      </div>

      <FinanceQueueFilters kind={filters.kind} status={filters.status} />

      {rows.length === 0 ? (
        <Alert tone="status">Tidak ada pengajuan yang menunggu.</Alert>
      ) : (
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                {FINANCE_QUEUE_COLUMNS.map((column) => (
                  <TableHead key={column.key}>{column.label}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const href = financeSubmissionHref(row.submissionId);
                return (
                  <TableRow key={row.invoiceId}>
                    {FINANCE_QUEUE_COLUMNS.map((column) => {
                      const cell = (() => {
                        switch (column.key) {
                          case "documentNumber":
                            return (
                              <span className="angka font-medium text-plum-900">
                                {row.documentNumber}
                              </span>
                            );
                          case "projectId":
                            return (
                              <span className="angka">{row.projectId}</span>
                            );
                          case "clientName":
                            return row.clientName;
                          case "amount":
                            return (
                              <span className="angka">
                                {formatProjectValue(row.amount) ?? row.amount}
                              </span>
                            );
                          case "dueDate":
                            return (
                              <span className="angka">
                                {formatDateId(row.dueDate)}
                              </span>
                            );
                          case "approvalStatus":
                            return (
                              <StatusBadge status={row.approvalStatus}>
                                {financeApprovalLabel(row.approvalStatus)}
                              </StatusBadge>
                            );
                          case "paymentStatus":
                            return financePaymentLabel(row.paymentStatus);
                          case "holdingLabel":
                            return financeHoldingDisplay(row);
                          case "waitingWorkingMinutes":
                            return (
                              <StatusBadge tone="pending">
                                {formatWorkingDuration(
                                  row.waitingWorkingMinutes,
                                )}
                              </StatusBadge>
                            );
                          default:
                            return null;
                        }
                      })();

                      return (
                        <TableCell key={column.key}>
                          <Link
                            href={href}
                            className="block underline-offset-2 hover:underline"
                          >
                            {cell}
                          </Link>
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
