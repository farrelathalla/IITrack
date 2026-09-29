"use client";

import {
  AlertCircle,
  CheckCircle2,
  Circle,
  ExternalLink,
  Lock,
  PenLine,
} from "lucide-react";
import type { ReactNode } from "react";
import { Alert } from "@/components/ui/alert";
import { formatDate } from "@/lib/time";

/** Banner read-only di atas tab divisi (PRD bab 2.4). */
export function ReadOnlyBanner({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-line bg-surface px-3 py-2 text-muted text-xs">
      <Lock className="size-3.5 shrink-0" />
      {children}
    </div>
  );
}

/** Kartu Feedback Reviewer: garis kiri merah, isi feedback, dan nama reviewer (PRD bab 6). */
export function FeedbackCard({
  feedback,
  reviewer,
  decidedAt,
  title = "Feedback Reviewer",
}: {
  feedback: string;
  reviewer: string;
  decidedAt?: Date | null;
  title?: string;
}) {
  return (
    <div className="rounded-lg border border-danger-line border-l-4 border-l-danger-dot bg-danger-bg/60 px-4 py-3">
      <div className="mb-1 flex items-center gap-1.5">
        <AlertCircle className="size-3.5 text-danger-text" />
        <p className="font-semibold text-danger-text text-xs">{title}</p>
      </div>
      <p className="text-ink text-xs leading-relaxed">
        &ldquo;{feedback}&rdquo;
      </p>
      <p className="mt-1 text-muted text-xs">
        {reviewer}
        {decidedAt ? `, ${formatDate(decidedAt)}` : ""}
      </p>
    </div>
  );
}

export function LockedBox({ reason }: { reason: string }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-line bg-surface p-4">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-full bg-line">
        <Lock className="size-4 text-subtle" />
      </div>
      <div>
        <p className="font-semibold text-ink text-sm">Stage ini terkunci</p>
        <p className="text-muted text-xs">{reason}</p>
      </div>
    </div>
  );
}

export function ErrorText({ error }: { error: string | null }) {
  if (!error) return null;
  return <Alert tone="danger">{error}</Alert>;
}

export function ExternalAnchor({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex max-w-full items-center gap-1 truncate font-medium text-plum-600 hover:underline"
    >
      <span className="truncate">{children}</span>
      <ExternalLink className="size-3 shrink-0" />
    </a>
  );
}

export function Subsection({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-[11px] text-muted uppercase tracking-wider">
          {title}
        </p>
        {action}
      </div>
      {children}
    </section>
  );
}

export function InfoGrid({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-line bg-white px-4 py-1">
      {children}
    </div>
  );
}

/**
 * Syarat selesai stage. Langkah pertama yang belum terpenuhi ditandai, supaya
 * jelas kenapa stage belum bisa lanjut.
 */
export function RequirementList({
  items,
}: {
  items: { label: string; done: boolean }[];
}) {
  if (items.length === 0) return null;
  const firstOpen = items.findIndex((item) => !item.done);
  const doneCount = items.filter((item) => item.done).length;
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="font-semibold text-ink text-xs">
          Syarat lanjut ke stage berikutnya
        </p>
        <span className="text-[11px] text-muted">
          {doneCount}/{items.length} terpenuhi
        </span>
      </div>
      <ol className="space-y-1.5">
        {items.map((item, index) => (
          <li
            key={item.label}
            className={
              index === firstOpen
                ? "flex items-center gap-2 rounded-md bg-white px-2 py-1 font-semibold text-ink text-xs shadow-sm"
                : "flex items-center gap-2 px-2 py-0.5 text-xs"
            }
          >
            {item.done ? (
              <CheckCircle2 className="size-4 shrink-0 text-success-text" />
            ) : (
              <Circle
                className={
                  index === firstOpen
                    ? "size-4 shrink-0 text-plum-600"
                    : "size-4 shrink-0 text-faint"
                }
              />
            )}
            <span
              className={
                item.done
                  ? "text-muted line-through decoration-faint"
                  : index === firstOpen
                    ? ""
                    : "text-muted"
              }
            >
              {item.label}
            </span>
            {index === firstOpen ? (
              <span className="ml-auto rounded bg-plum-50 px-1.5 py-0.5 font-semibold text-[10px] text-plum-600">
                Berikutnya
              </span>
            ) : null}
          </li>
        ))}
      </ol>
    </div>
  );
}

/**
 * Kotak "tinggal tanda tangan" untuk dokumen yang sudah disetujui. Dibuat
 * mencolok karena langkah ini sering terlewat dan stage tidak lanjut tanpanya.
 */
export function SignCallout({
  label,
  canSign,
  pending,
  onSign,
  signerHint,
}: {
  label: string;
  canSign: boolean;
  pending: boolean;
  onSign: () => void;
  signerHint: string;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border-2 border-warning-line bg-warning-bg px-4 py-3">
      <PenLine className="size-5 shrink-0 text-warning-text" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-ink text-sm">
          Tinggal tanda tangan: {label}
        </p>
        <p className="text-muted text-xs">
          {canSign
            ? `Setelah ${signerHint} tanda tangan, ganti tautannya dengan versi bertanda tangan lalu klik tombol ini. Stage belum bisa lanjut sebelum ditandai.`
            : `Menunggu PM menandai ${label} sudah ditandatangani ${signerHint}.`}
        </p>
      </div>
      {canSign ? (
        <button
          type="button"
          disabled={pending}
          onClick={onSign}
          className="pressable inline-flex h-10 items-center gap-2 rounded-lg bg-plum-600 px-4 font-semibold text-sm text-white hover:bg-plum-700 disabled:opacity-50"
        >
          <PenLine className="size-4" />
          Tandai Ditandatangani
        </button>
      ) : null}
    </div>
  );
}
