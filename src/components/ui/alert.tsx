import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AlertTone = "info" | "warning" | "danger" | "success";

const TONE: Record<AlertTone, string> = {
  info: "border-plum-200 bg-plum-50 text-plum-600",
  warning: "border-warning-line bg-warning-bg text-warning-text",
  danger: "border-danger-line bg-danger-bg text-danger-text",
  success: "border-success-line bg-success-bg text-success-text",
};

/** Pesan tingkat halaman atau formulir. Untuk galat per kolom pakai FieldError. */
export function Alert({
  tone,
  children,
  className,
}: {
  tone: AlertTone;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      role={tone === "danger" ? "alert" : "status"}
      className={cn(
        "rounded-lg border px-3 py-2 text-xs leading-relaxed",
        TONE[tone],
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Teks galat di bawah satu kolom formulir. */
export function FieldError({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p role="alert" className={cn("text-danger-text text-xs", className)}>
      {children}
    </p>
  );
}
