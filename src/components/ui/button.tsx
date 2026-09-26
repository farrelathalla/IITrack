import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-plum-600 font-semibold text-white hover:bg-plum-700",
  secondary:
    "border border-plum-200 bg-white font-medium text-muted hover:bg-surface hover:text-ink",
  ghost:
    "bg-transparent font-medium text-muted hover:bg-surface hover:text-ink",
  danger: "bg-danger-dot font-semibold text-white hover:bg-danger-text",
  success: "bg-success-text font-semibold text-white hover:bg-[#155c3b]",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "h-7 px-2.5 text-[11px]",
  md: "h-8 px-3.5 text-xs",
};

const BASE =
  "pressable inline-flex shrink-0 select-none items-center justify-center gap-1.5 whitespace-nowrap rounded-lg disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:size-3.5";

/** Kelas tombol untuk elemen lain, misalnya `<Link>` yang tampil seperti tombol. */
export function buttonClass(
  variant: ButtonVariant = "primary",
  size: ButtonSize = "md",
  className?: string,
): string {
  return cn(BASE, VARIANT[variant], SIZE[size], className);
}

/**
 * Tombol bersama. `primary` untuk aksi utama (maroon), `secondary` untuk aksi
 * pendamping (garis maroon), `success`/`danger` untuk Setujui/Tolak di baris
 * aksi approver seperti prototipe.
 */
export function Button({
  variant = "primary",
  size = "md",
  className,
  children,
  type = "button",
  ...props
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={buttonClass(variant, size, className)}
      {...props}
    >
      {children}
    </button>
  );
}
