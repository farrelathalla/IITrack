"use client";

import { ExternalLink, Link2, Plus } from "lucide-react";
import { useState } from "react";
import { saveDocumentAction } from "@/app/(internal)/projects/[code]/actions";
import { Badge, type Tone } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select-field";
import { TextField } from "@/components/ui/text-field";
import {
  DOCUMENT_STATUS_LABELS,
  DOCUMENTS,
  type DocumentKind,
  type DocumentStatus,
} from "@/lib/project/catalog";
import {
  type DocumentSnapshot,
  documentOf,
  latestSubmission,
  pmOf,
} from "@/lib/project/snapshot";
import { formatDate, toDateInput } from "@/lib/time";
import { ErrorText } from "./bits";
import { useProject, useRunner } from "./context";

const STATUS_TONE: Record<DocumentStatus, Tone> = {
  MISSING: "danger",
  IN_PROGRESS: "warning",
  SUBMITTED: "brand",
  DONE: "success",
};

export function documentBadge(
  doc: DocumentSnapshot | null,
  latest: ReturnType<typeof latestSubmission>,
): { label: string; tone: Tone } {
  if (doc?.signedAt) return { label: "Ditandatangani", tone: "success" };
  if (latest?.status === "APPROVED")
    return { label: "Disetujui", tone: "success" };
  if (latest?.status === "PENDING")
    return { label: "Diajukan", tone: "warning" };
  if (latest?.status === "REJECTED")
    return { label: "Revisi Diperlukan", tone: "danger" };
  const status = doc?.status ?? "MISSING";
  return { label: DOCUMENT_STATUS_LABELS[status], tone: STATUS_TONE[status] };
}

/**
 * Kartu dokumen yang sama untuk semua dokumen (PRD bab 4.3). IITrack tidak
 * membuat dokumen; kartu ini hanya menyimpan tautan, tenggat, dan statusnya.
 */
export function DocumentCard({
  kind,
  developerId = "",
  title,
  editable,
  statusOptions,
}: {
  kind: DocumentKind;
  developerId?: string;
  title?: string;
  /** Pengguna boleh menambah atau mengganti tautan dokumen ini. */
  editable: boolean;
  /** Status yang bisa dipilih PM, bila dokumen ini punya status manual. */
  statusOptions?: DocumentStatus[];
}) {
  const view = useProject();
  const { project, hiddenDocumentIds } = view;
  const def = DOCUMENTS[kind];
  const doc = documentOf(project, kind, developerId);
  const latest = latestSubmission(project, doc?.id);
  const badge = documentBadge(doc, latest);
  const hidden = doc ? hiddenDocumentIds.includes(doc.id) : false;
  const locked =
    latest?.status === "PENDING" ||
    (latest?.status === "APPROVED" && kind !== "MOU") ||
    Boolean(doc?.signedAt && kind !== "BAST");
  const [open, setOpen] = useState(false);
  const { run, pending, error } = useRunner();
  const owner = doc?.ownerName ?? pmOf(project)?.name ?? "—";

  function submit(formData: FormData) {
    const url = String(formData.get("url") ?? "");
    const deadline = String(formData.get("deadline") ?? "");
    const status = formData.get("status");
    run(
      () =>
        saveDocumentAction(project.code, {
          kind,
          developerId,
          url,
          deadline,
          ...(status ? { status: status as DocumentStatus } : {}),
        }),
      () => setOpen(false),
    );
  }

  return (
    <div className="rounded-lg border border-line bg-white p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-1.5">
            <p className="font-semibold text-ink text-sm">
              {title ?? def.name}
            </p>
            <Badge tone={def.required ? "brand" : "neutral"}>
              {def.required ? "Wajib" : "Opsional"}
            </Badge>
          </div>
          <p className="mt-0.5 text-[11px] text-subtle">Pemilik: {owner}</p>
        </div>
        <Badge tone={badge.tone}>{badge.label}</Badge>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {doc?.url ? (
          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-lg border border-plum-200 px-3 py-1.5 font-semibold text-plum-600 text-xs hover:bg-plum-50"
          >
            <ExternalLink className="size-3.5" />
            Buka Dokumen
          </a>
        ) : hidden ? (
          <span className="rounded-lg bg-surface px-3 py-1.5 text-subtle text-xs">
            Tautan disembunyikan
          </span>
        ) : null}
        {editable && !locked ? (
          <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
            {doc?.url ? (
              <Link2 className="size-3.5" />
            ) : (
              <Plus className="size-3.5" />
            )}
            {doc?.url ? "Ganti Link" : "Tambah Link"}
          </Button>
        ) : null}
        {!doc?.url && !hidden && !editable ? (
          <span className="text-subtle text-xs">Belum ada tautan</span>
        ) : null}
        {doc?.deadline ? (
          <span className="ml-auto text-[11px] text-subtle">
            Tenggat: {formatDate(doc.deadline)}
          </span>
        ) : null}
      </div>

      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={
          doc?.url
            ? `Ganti Link — ${title ?? def.name}`
            : `Tambah Link — ${title ?? def.name}`
        }
      >
        <form action={submit} className="space-y-3">
          <ErrorText error={error} />
          <TextField
            label="Tautan dokumen"
            name="url"
            type="url"
            placeholder="https://docs.google.com/…"
            defaultValue={doc?.url ?? ""}
            hint="Dokumen dibuat di Google Docs atau Drive. IITrack hanya menyimpan tautannya."
          />
          <TextField
            label="Tenggat (opsional)"
            name="deadline"
            type="date"
            defaultValue={toDateInput(doc?.deadline)}
          />
          {statusOptions ? (
            <SelectField
              label="Status dokumen"
              name="status"
              defaultValue={doc?.status ?? "IN_PROGRESS"}
            >
              {statusOptions.map((s) => (
                <option key={s} value={s}>
                  {DOCUMENT_STATUS_LABELS[s]}
                </option>
              ))}
            </SelectField>
          ) : null}
          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Menyimpan…" : "Simpan"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}
