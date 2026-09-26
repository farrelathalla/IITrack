"use client";

import { AlertCircle, ExternalLink, Lock } from "lucide-react";
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
      <p className="text-ink text-sm leading-relaxed">
        &ldquo;{feedback}&rdquo;
      </p>
      <p className="mt-1 text-muted text-xs">
        — {reviewer}
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
        <p className="font-semibold text-[11px] text-muted uppercase tracking-wider">
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
