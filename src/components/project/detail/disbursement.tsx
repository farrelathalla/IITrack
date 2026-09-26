"use client";

import { Check, CheckCircle2, Send, X } from "lucide-react";
import { useState } from "react";
import {
  closeProjectAction,
  decideDisbursementAction,
  markDisbursedAction,
  submitDisbursementAction,
  verifyDisbursementAction,
} from "@/app/(internal)/projects/[code]/actions";
import { DISBURSEMENT_TONE } from "@/components/project/tones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoRow } from "@/components/ui/card";
import {
  DISBURSEMENT_LABELS,
  disbursementDisplay,
} from "@/lib/project/closure";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ErrorText, FeedbackCard, InfoGrid } from "./bits";
import { useProject, useRunner } from "./context";
import { RejectDialog } from "./submission-bar";

/** Kartu Final Disbursement (PRD bab 5.5). */
export function DisbursementBlock() {
  const { project, can, disbursementMissing } = useProject();
  const { run, pending, error } = useRunner();
  const [rejecting, setRejecting] = useState(false);
  const disb = project.disbursement;
  const status = disbursementDisplay(project);
  const code = project.code;

  return (
    <div className="space-y-3">
      <InfoGrid>
        <InfoRow label="Status">
          <Badge tone={DISBURSEMENT_TONE[status]} dot>
            {DISBURSEMENT_LABELS[status]}
          </Badge>
        </InfoRow>
        {disb ? (
          <InfoRow label="Diajukan">{formatDateTime(disb.submittedAt)}</InfoRow>
        ) : null}
        {disb?.verifiedAt ? (
          <InfoRow label="Diverifikasi Finance POC">
            {formatDateTime(disb.verifiedAt)}
          </InfoRow>
        ) : null}
        {disb?.decidedAt && disb.status !== "REJECTED" ? (
          <InfoRow label="Disetujui">{`${disb.decidedByName ?? "CFO"}, ${formatDateTime(disb.decidedAt)}`}</InfoRow>
        ) : null}
        {disb?.disbursedAt ? (
          <InfoRow label="Dicairkan">
            {formatDateTime(disb.disbursedAt)}
          </InfoRow>
        ) : null}
        <InfoRow label="Nominal pembagian">Dihitung di sistem Finance</InfoRow>
      </InfoGrid>

      {disb?.status === "REJECTED" && disb.feedback ? (
        <FeedbackCard
          feedback={disb.feedback}
          reviewer={disb.decidedByName ?? "CFO / Vice CFO"}
          decidedAt={disb.decidedAt}
        />
      ) : null}
      <ErrorText error={error} />

      <div className="flex flex-wrap items-center gap-2">
        {can["disbursement.submit"] && (!disb || disb.status === "REJECTED") ? (
          <>
            <Button
              disabled={pending || disbursementMissing.length > 0}
              onClick={() => run(() => submitDisbursementAction(code))}
            >
              <Send className="size-3.5" />
              {disb
                ? "Ajukan Ulang Finance Disbursement"
                : "Ajukan Finance Disbursement"}
            </Button>
            {disbursementMissing.length > 0 ? (
              <span className="text-subtle text-xs">
                Belum bisa diajukan: {disbursementMissing.join(", ")}.
              </span>
            ) : null}
          </>
        ) : null}
        {can["disbursement.finance"] && disb?.status === "SUBMITTED" ? (
          <Button
            disabled={pending}
            onClick={() => run(() => verifyDisbursementAction(code))}
          >
            <Send className="size-3.5" />
            Kirim ke CFO
          </Button>
        ) : null}
        {can["disbursement.decide"] && disb?.status === "VERIFIED" ? (
          <div className="flex items-center gap-2 rounded-lg border border-warning-line bg-warning-bg px-3 py-2">
            <span className="font-medium text-warning-text text-xs">
              Berikan keputusan:
            </span>
            <Button
              variant="success"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => decideDisbursementAction(code, "APPROVE"))
              }
            >
              <Check className="size-3.5" />
              Setujui
            </Button>
            <Button
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() => setRejecting(true)}
            >
              <X className="size-3.5" />
              Tolak
            </Button>
          </div>
        ) : null}
        {disb?.status === "VERIFIED" && !can["disbursement.decide"] ? (
          <span className="rounded-lg bg-warning-bg px-3 py-2 text-warning-text text-xs">
            Menunggu persetujuan dari CFO / Vice CFO
          </span>
        ) : null}
        {disb?.status === "SUBMITTED" && !can["disbursement.finance"] ? (
          <span className="rounded-lg bg-warning-bg px-3 py-2 text-warning-text text-xs">
            Menunggu verifikasi Finance POC
          </span>
        ) : null}
        {can["disbursement.finance"] && disb?.status === "APPROVED" ? (
          <Button
            variant="success"
            disabled={pending}
            onClick={() => run(() => markDisbursedAction(code))}
          >
            <Check className="size-3.5" />
            Tandai Dicairkan
          </Button>
        ) : null}
      </div>

      <RejectDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title="Tolak Finance Disbursement"
        pending={pending}
        error={error}
        onReject={(feedback) =>
          run(
            () => decideDisbursementAction(code, "REJECT", feedback),
            () => setRejecting(false),
          )
        }
      />
    </div>
  );
}

export function ChecklistRow({
  label,
  done,
}: {
  label: string;
  done: boolean;
}) {
  return (
    <div className="flex items-center gap-3 border-surface border-b py-2 last:border-0">
      <span
        className={cn(
          "flex size-5 items-center justify-center rounded border",
          done
            ? "border-success-line bg-success-bg"
            : "border-plum-200 bg-white",
        )}
      >
        {done ? <Check className="size-3 text-success-text" /> : null}
      </span>
      <span
        className={cn(
          "flex-1 text-sm",
          done ? "text-muted line-through" : "font-medium text-ink",
        )}
      >
        {label}
      </span>
      <Badge tone={done ? "success" : "danger"}>
        {done ? "Selesai" : "Belum"}
      </Badge>
    </div>
  );
}

/** Closure Checklist beserta tombol penutupan (PRD bab 4.12). */
export function ClosureBlock() {
  const { project, checklist, can } = useProject();
  const { run, pending, error } = useRunner();
  const ready = checklist.every((item) => item.done);

  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-line bg-white px-4 py-1">
        {checklist.map((item) => (
          <ChecklistRow key={item.key} label={item.label} done={item.done} />
        ))}
      </div>
      {project.closedAt ? (
        <div className="flex items-center gap-2 rounded-lg border border-success-line bg-success-bg px-4 py-3 text-success-text text-sm">
          <CheckCircle2 className="size-4" />
          Project ditutup {formatDateTime(project.closedAt)}.
        </div>
      ) : (
        <div
          className={cn(
            "rounded-lg border p-4",
            ready
              ? "border-success-line bg-success-bg"
              : "border-line bg-surface",
          )}
        >
          <p className="font-semibold text-ink text-sm">
            {ready ? "Semua syarat terpenuhi" : "Belum semua syarat terpenuhi"}
          </p>
          <p className="text-muted text-xs">
            {ready
              ? "Project siap untuk ditandai sebagai Selesai dan dipindahkan ke arsip."
              : "Selesaikan semua item di checklist sebelum menutup project."}
          </p>
          <ErrorText error={error} />
          {ready && can["project.close"] ? (
            <Button
              variant="success"
              className="mt-3"
              disabled={pending}
              onClick={() => run(() => closeProjectAction(project.code))}
            >
              <CheckCircle2 className="size-4" />
              Tandai Project Sebagai Selesai
            </Button>
          ) : null}
        </div>
      )}
    </div>
  );
}
