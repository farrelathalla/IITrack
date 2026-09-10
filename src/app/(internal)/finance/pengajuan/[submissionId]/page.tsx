import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { RecordTransferProofForm } from "@/app/(internal)/projects/[projectId]/receipt-form";
import { ValidateReceiptForm } from "@/app/(internal)/projects/[projectId]/validate-receipt-form";
import { Alert, StatusBadge } from "@/components/ui";
import { buildApprovalChain } from "@/lib/approval/chain";
import { canSeeSubmissionDecision } from "@/lib/finance/decision";
import {
  canSeeFinanceQueue,
  FINANCE_QUEUE_HREF,
  FINANCE_SUBMISSION_SECTIONS,
  financeApprovalLabel,
  financeHoldingDisplay,
  financePaymentLabel,
} from "@/lib/finance/display";
import {
  canSeeReceiptForm,
  canSeeValidateReceipt,
} from "@/lib/finance/receipt-form";
import { formatDateId } from "@/lib/member/ui";
import {
  formatDateTimeId,
  formatProjectValue,
} from "@/lib/project/hub-display";
import { formatWorkingDuration } from "@/lib/sla/display";
import { getAuthenticatedSession } from "@/server/auth/session";
import { readFinanceQueue } from "@/server/finance/queue";
import { projectContextFor } from "@/server/project/context";
import { SubmissionDecisionForm } from "./decision-form";

export const metadata: Metadata = {
  title: "Rincian pengajuan",
};

export default async function FinanceSubmissionPage({
  params,
}: {
  params: Promise<{ submissionId: string }>;
}) {
  const session = await getAuthenticatedSession();
  if (!session) notFound();

  const now = new Date();
  if (!canSeeFinanceQueue(session.actor, now)) notFound();

  const { submissionId } = await params;
  const antrean = await readFinanceQueue(session.actor, now);
  if (!antrean.ok) {
    return <Alert tone="danger">{antrean.reason}</Alert>;
  }

  const item = antrean.items.find((row) => row.submissionId === submissionId);
  if (!item) notFound();

  const rantai = buildApprovalChain("INVOICE");
  const konteks = await projectContextFor(session.actor, item.projectDbId, now);
  const bolehCatatKuitansi = canSeeReceiptForm(session.actor, konteks, now);
  const bolehValidasiKuitansi = canSeeValidateReceipt(
    session.actor,
    konteks,
    now,
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-slate-500 text-xs">
          <Link
            href={FINANCE_QUEUE_HREF}
            className="underline-offset-4 hover:underline"
          >
            Antrean Finance
          </Link>
          {" / "}
          Rincian
        </p>
        <h1 className="text-xl">
          <span className="angka">{item.documentNumber}</span>
        </h1>
        <p className="text-slate-500">
          <Link
            href={`/projects/${encodeURIComponent(item.projectId)}`}
            className="font-medium text-plum-900 underline-offset-4 hover:underline"
          >
            {item.projectId}
          </Link>
        </p>
      </div>

      {FINANCE_SUBMISSION_SECTIONS.map((section) => (
        <section
          key={section.key}
          className="flex flex-col gap-3 rounded-card border border-line bg-white p-5"
        >
          <h2 className="text-base">{section.title}</h2>
          {section.key === "document" ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500 text-xs">Client</dt>
                <dd>{item.clientName}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">Nominal</dt>
                <dd className="angka">
                  {formatProjectValue(item.amount) ?? item.amount}
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">Jatuh tempo</dt>
                <dd className="angka">{formatDateId(item.dueDate)}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">Status approval</dt>
                <dd>
                  <StatusBadge status={item.approvalStatus}>
                    {financeApprovalLabel(item.approvalStatus)}
                  </StatusBadge>
                </dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">Status pembayaran</dt>
                <dd>{financePaymentLabel(item.paymentStatus)}</dd>
              </div>
            </dl>
          ) : null}
          {section.key === "waiting" ? (
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500 text-xs">Sedang menunggu</dt>
                <dd>{financeHoldingDisplay(item)}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">Masuk antrean</dt>
                <dd className="angka">{formatDateTimeId(item.waitingSince)}</dd>
              </div>
              <div>
                <dt className="text-slate-500 text-xs">Lama menunggu</dt>
                <dd>
                  <StatusBadge tone="pending">
                    {formatWorkingDuration(item.waitingWorkingMinutes)}
                  </StatusBadge>
                </dd>
              </div>
            </dl>
          ) : null}
          {section.key === "chain" ? (
            <ol className="flex flex-col gap-2 text-sm">
              {rantai.map((step) => {
                const berjalan =
                  item.state === "MENUNGGU_PERSETUJUAN" &&
                  item.holdingLabel === step.label;
                return (
                  <li key={step.order} className="flex items-center gap-2">
                    <span className="angka text-slate-500">{step.order}.</span>
                    <span>{step.label}</span>
                    {berjalan ? (
                      <StatusBadge tone="pending">berjalan</StatusBadge>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          ) : null}
          {section.key === "decision" ? (
            <div className="flex flex-col gap-4">
              {canSeeSubmissionDecision(session.actor, item, now) &&
              item.holdingLabel ? (
                <SubmissionDecisionForm
                  submissionId={item.submissionId}
                  holdingLabel={item.holdingLabel}
                />
              ) : (
                <p className="text-slate-500 text-sm">
                  {item.state === "MENUNGGU_PERSETUJUAN"
                    ? `Keputusan hanya bisa diambil pemegang langkah yang sedang berjalan${item.holdingLabel ? ` (${item.holdingLabel})` : ""}.`
                    : "Tidak ada keputusan persetujuan pada keadaan ini."}
                </p>
              )}
              {bolehCatatKuitansi && item.state === "MENUNGGU_PEMBAYARAN" ? (
                <RecordTransferProofForm
                  invoice={{
                    id: item.invoiceId,
                    number: item.documentNumber,
                    amount: item.amount,
                    projectId: item.projectId,
                    clientName: item.clientName,
                  }}
                />
              ) : null}
              {bolehValidasiKuitansi &&
              item.state === "MENUNGGU_VERIFIKASI" &&
              item.receiptId ? (
                <ValidateReceiptForm
                  receiptId={item.receiptId}
                  warning={null}
                />
              ) : null}
            </div>
          ) : null}
        </section>
      ))}
    </div>
  );
}
