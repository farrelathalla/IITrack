import type { ReactNode } from "react";
import {
  STATUS_TONE_CLASS,
  type StatusTone,
  toneForStatus,
} from "@/lib/ui/status";
import { cn } from "@/lib/utils";

/**
 * Penanda status ringkas. Bisa diberi `tone` langsung, atau `status` teks
 * bisnis yang dipetakan lewat `toneForStatus`.
 */
export function StatusBadge({
  children,
  status,
  tone,
  className,
}: {
  children: ReactNode;
  status?: string;
  tone?: StatusTone;
  className?: string;
}) {
  const resolved = tone ?? (status ? toneForStatus(status) : "neutral");

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 font-medium text-xs",
        STATUS_TONE_CLASS[resolved],
        className,
      )}
    >
      {children}
    </span>
  );
}
