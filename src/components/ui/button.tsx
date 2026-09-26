import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";
type ButtonSize = "sm" | "md";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "bg-plum-600 text-white hover:bg-plum-700",
  secondary:
    "border border-plum-200 bg-white text-plum-600 hover:border-plum-300 hover:bg-plum-50",
  ghost: "bg-transparent text-muted hover:bg-surface hover:text-ink",
  danger: "bg-danger-dot text-white hover:bg-danger-text",
  success: "bg-success-text text-white hover:bg-[#155c3b]",
};

const SIZE: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs",
  md: "px-4 py-2 text-sm",
};

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
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-plum-600/30 disabled:cursor-not-allowed disabled:opacity-50",
        VARIANT[variant],
        SIZE[size],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
