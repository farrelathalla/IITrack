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
import { Button } from "@/components/ui/button";
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
  signable = false,
}: {
  kind: DocumentKind;
  developerId?: string;
  label: string;
  approverLabel: string;
  canSubmit: boolean;
  canDecide: boolean;
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
                className="pressable inline-flex items-center gap-1.5 rounded-lg border border-plum-200 bg-white px-4 py-2 font-semibold text-plum-600 text-sm hover:bg-plum-50"
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

        {latest?.status === "PENDING" && !canDecide ? (
          <span className="inline-flex items-center gap-1.5 rounded-lg bg-warning-bg px-3 py-2 font-medium text-warning-text text-xs">
            <Clock className="size-3.5" />
            Menunggu persetujuan dari {approverLabel}
          </span>
        ) : null}

        {latest?.status === "PENDING" && canDecide ? (
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
          <span className="text-success-text text-xs">
            Disetujui oleh {latest.decidedByName}
            {latest.decidedAt ? `, ${formatDateTime(latest.decidedAt)}` : ""}
          </span>
        ) : null}

        {signable &&
        latest?.status === "APPROVED" &&
        !doc?.signedAt &&
        canSubmit ? (
          <Button
            variant="secondary"
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
            <PenLine className="size-3.5" />
            Tandai Ditandatangani
          </Button>
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
