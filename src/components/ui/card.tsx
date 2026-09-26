import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Kartu putih bersudut membulat, pola dasar seluruh halaman prototipe. */
export function Card({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border border-line bg-white shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Judul kecil berhuruf kapital di dalam panel ("Dokumen Utama", dan lain-lain). */
export function SectionLabel({
  children,
  className,
  action,
}: {
  children: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  return (
    <div
      className={cn("mb-2 flex items-center justify-between gap-2", className)}
    >
      <p className="font-bold text-[11px] text-muted uppercase tracking-wider">
        {children}
      </p>
      {action}
    </div>
  );
}

/** Pasangan label-nilai dalam grid informasi. */
export function InfoRow({
  label,
  children,
  className,
}: {
  label: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 border-surface border-b py-2.5 last:border-b-0",
        className,
      )}
    >
      <span className="shrink-0 text-muted text-xs">{label}</span>
      <div className="flex min-w-0 items-center justify-end gap-2 text-right font-semibold text-ink text-xs">
        {children}
      </div>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-white p-10 text-center text-subtle text-xs">
      {children}
    </div>
  );
}
