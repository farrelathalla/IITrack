import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "success" | "warning" | "danger" | "brand" | "neutral";

export const TONE_BADGE: Record<Tone, string> = {
  success: "border-success-line bg-success-bg text-success-text",
  warning: "border-warning-line bg-warning-bg text-warning-text",
  danger: "border-danger-line bg-danger-bg text-danger-text",
  brand: "border-plum-200 bg-plum-50 text-plum-600",
  neutral: "border-line bg-surface text-subtle",
};

export const TONE_DOT: Record<Tone, string> = {
  success: "bg-success-text",
  warning: "bg-warning-dot",
  danger: "bg-danger-dot",
  brand: "bg-plum-600",
  neutral: "bg-faint",
};

/** Badge status berwarna seperti prototipe, opsional dengan titik di depan. */
export function Badge({
  tone = "neutral",
  dot = false,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 font-medium text-[11px]",
        TONE_BADGE[tone],
        className,
      )}
    >
      {dot ? (
        <span className={cn("size-1.5 rounded-full", TONE_DOT[tone])} />
      ) : null}
      {children}
    </span>
  );
}
