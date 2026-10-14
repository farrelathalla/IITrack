"use client";

import {
  Check,
  Clock,
  ExternalLink,
  PenLine,
  RotateCw,
  Send,
  X,
} from "lucide-react";
import { useState } from "react";
import {
  decideSubmissionAction,
  markSignedAction,
  submitDocumentAction,
} from "@/app/(internal)/projects/[code]/actions";
import { Button, buttonClass } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextArea } from "@/components/ui/text-area";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { DocumentKind } from "@/lib/project/catalog";
import { documentOf, latestSubmission } from "@/lib/project/snapshot";
import { formatDateTime } from "@/lib/time";
import { ErrorText, FeedbackCard } from "./bits";
import { useProject, useRunner } from "./context";

/** Dialog Tolak: feedback wajib diisi (PRD bab 6 dan 10). */
export function RejectDialog({
  open,
  onOpenChange,
  title,
  onReject,
  pending,
  error,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onReject: (feedback: string) => void;
  pending: boolean;
  error: string | null;
}) {
  const [feedback, setFeedback] = useState("");
  return (
    <Dialog open={open} onOpenChange={onOpenChange} title={title}>
      <div className="space-y-3">
        <ErrorText error={error} />
        <TextArea
          label="Feedback untuk pengaju"
          name="feedback"
          required
          value={feedback}
          onChange={(e) => setFeedback(e.target.value)}
          placeholder="Jelaskan apa yang perlu diperbaiki."
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button
            variant="danger"
            disabled={pending || feedback.trim() === ""}
            onClick={() => onReject(feedback)}
          >
            {pending ? "Mengirim…" : "Tolak dengan Feedback"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/**
 * Pola pengajuan yang sama untuk Project Charter, MoU, dan Kontrak Programmer.
 * Pengaju tidak memilih approver; approvernya ditentukan jenis pengajuan.
 */
export function SubmissionBar({
  kind,
  developerId = "",
  label,
  approverLabel,
  canSubmit,
  canDecide,
  canDecideTech = false,
  signable = false,
}: {
  kind: DocumentKind;
  developerId?: string;
  label: string;
  approverLabel: string;
  canSubmit: boolean;
  canDecide: boolean;
  /** Project Charter juga menunggu CTO / Vice CTO. */
  canDecideTech?: boolean;
  signable?: boolean;
}) {
  const { project, viewer, hiddenDocumentIds } = useProject();
  const doc = documentOf(project, kind, developerId);
  const latest = latestSubmission(project, doc?.id);
  const { run, pending, error } = useRunner();
  const [rejecting, setRejecting] = useState(false);
  const docUrl = doc?.url ?? null;

  const submit = () =>
    run(() =>
      submitDocumentAction(project.code, kind, developerId || undefined),
    );

  return (
    <div className="space-y-3">
      {latest?.status === "REJECTED" && latest.feedback ? (
        <FeedbackCard
          feedback={latest.feedback}
          reviewer={latest.decidedByName ?? approverLabel}
          decidedAt={latest.decidedAt}
        />
      ) : null}
      <ErrorText error={error} />

      <div className="flex flex-wrap items-center gap-2">
        {!latest && canSubmit ? (
          <Button onClick={submit} disabled={pending || !docUrl}>
            <Send className="size-3.5" />
            Ajukan untuk Persetujuan
          </Button>
        ) : null}
        {!latest &&
        canSubmit &&
        !docUrl &&
        !hiddenDocumentIds.includes(doc?.id ?? "") ? (
          <span className="text-subtle text-xs">
            Tautkan {label} terlebih dahulu.
          </span>
        ) : null}

        {latest?.status === "REJECTED" && canSubmit ? (
          <>
            {docUrl ? (
              <a
                href={docUrl}
                target="_blank"
                rel="noopener noreferrer"
                className={buttonClass("secondary")}
              >
                <ExternalLink className="size-3.5" />
                Edit Dokumen
              </a>
            ) : null}
            <Button onClick={submit} disabled={pending}>
              <RotateCw className="size-3.5" />
              Ajukan Ulang
            </Button>
          </>
        ) : null}

        {kind === "PROJECT_CHARTER" && latest?.status === "PENDING" ? (
          <ul className="w-full space-y-1 rounded-lg border border-line bg-surface px-4 py-3 text-sm">
            <li>
              COO / Vice COO:{" "}
              {latest.opsApprovedAt
                ? `sudah disetujui${latest.opsApprovedByName ? ` oleh ${latest.opsApprovedByName}` : ""}`
                : "belum menyetujui"}
            </li>
            <li>
              CTO / Vice CTO:{" "}
              {latest.techApprovedAt
                ? `sudah disetujui${latest.techApprovedByName ? ` oleh ${latest.techApprovedByName}` : ""}`
                : "belum menyetujui"}
            </li>
          </ul>
        ) : null}

        {latest?.status === "PENDING" &&
        !canDecide &&
        !(kind === "PROJECT_CHARTER" && canDecideTech) ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-warning-bg px-3 py-2 font-medium text-warning-text text-xs">
            <Clock className="size-3.5" />
            Menunggu persetujuan dari {approverLabel}
          </span>
        ) : null}

        {latest?.status === "PENDING" &&
        (canDecide || (kind === "PROJECT_CHARTER" && canDecideTech)) &&
        !(
          kind === "PROJECT_CHARTER" &&
          ((canDecide && latest.opsApprovedAt) ||
            (canDecideTech && latest.techApprovedAt && !canDecide))
        ) ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-warning-line bg-warning-bg px-3 py-2">
            <span className="font-medium text-warning-text text-xs">
              Sebagai {viewer.role ? ROLE_LABELS[viewer.role] : "approver"},
              berikan keputusan:
            </span>
            <Button
              variant="success"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() =>
                  decideSubmissionAction(project.code, latest.id, "APPROVE"),
                )
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

        {latest?.status === "APPROVED" ? (
          <span className="font-medium text-sm text-success-text">
            {kind === "PROJECT_CHARTER"
              ? `Disetujui COO${latest.opsApprovedByName ? ` (${latest.opsApprovedByName})` : ""} dan CTO${latest.techApprovedByName ? ` (${latest.techApprovedByName})` : ""}`
              : `Disetujui oleh ${latest.decidedByName ?? approverLabel}${latest.decidedAt ? `, ${formatDateTime(latest.decidedAt)}` : ""}`}
          </span>
        ) : null}

        {signable &&
        latest?.status === "APPROVED" &&
        !doc?.signedAt &&
        canSubmit ? (
          <div className="w-full rounded-xl border-2 border-warning-dot bg-warning-bg px-5 py-4">
            <p className="font-bold text-ink text-base">
              Tanda tangan {label} belum dicatat
            </p>
            <p className="mt-1 text-ink text-sm">
              Persetujuan internal sudah ada. Stage berikutnya tetap terkunci
              sampai tombol di bawah ini ditekan.
            </p>
            <Button
              size="lg"
              className="mt-4"
              disabled={pending}
              onClick={() =>
                run(() =>
                  markSignedAction(
                    project.code,
                    kind as "MOU" | "PROGRAMMER_CONTRACT",
                    developerId || undefined,
                  ),
                )
              }
            >
              <PenLine className="size-4" />
              Tandai Ditandatangani
            </Button>
          </div>
        ) : null}
        {doc?.signedAt ? (
          <span className="text-success-text text-xs">
            Ditandatangani {formatDateTime(doc.signedAt)}
          </span>
        ) : null}
      </div>

      {latest?.status === "REJECTED" && latest.decidedByName ? (
        <p className="text-[11px] text-subtle">
          Ditolak oleh {latest.decidedByName}
          {latest.decidedAt ? `, ${formatDateTime(latest.decidedAt)}` : ""}
        </p>
      ) : null}

      <RejectDialog
        open={rejecting}
        onOpenChange={setRejecting}
        title={`Tolak ${label}`}
        pending={pending}
        error={error}
        onReject={(feedback) =>
          latest &&
          run(
            () =>
              decideSubmissionAction(
                project.code,
                latest.id,
                "REJECT",
                feedback,
              ),
            () => setRejecting(false),
          )
        }
      />
    </div>
  );
}
