import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

type AlertTone = "status" | "danger";

const TONE: Record<AlertTone, string> = {
  status: "border-amber-text/20 bg-amber-bg text-amber-text",
  danger: "border-danger-text/20 bg-danger-bg text-danger-text",
};

/**
 * Kotak pemberitahuan tingkat halaman. `status` untuk info netral (sesi
 * berakhir, logout); `danger` untuk penolakan dari server (Design Brief bab 5).
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
