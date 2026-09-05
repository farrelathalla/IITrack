import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AlertTone = "status" | "danger" | "success";

const TONE: Record<AlertTone, string> = {
  status: "border-amber-text/20 bg-amber-bg text-amber-text",
  danger: "border-danger-text/20 bg-danger-bg text-danger-text",
  success: "border-success-text/20 bg-success-bg text-success-text",
};

/**
 * Pesan tingkat halaman atau tingkat formulir.
 *
 * Design Brief bab 5 membedakan galat per kolom dari galat/penolakan tingkat
 * halaman. Pakai komponen ini untuk yang kedua; untuk teks di bawah satu field
 * pakai `FieldError`.
 */
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
    <p
      role={tone === "danger" ? "alert" : "status"}
      className={cn("rounded-card border px-3 py-2", TONE[tone], className)}
    >
      {children}
    </p>
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
