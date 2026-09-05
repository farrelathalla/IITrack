import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";

const VARIANT: Record<ButtonVariant, string> = {
  primary:
    "bg-plum-900 text-white hover:bg-plum-950 focus-visible:ring-plum-400/40",
  secondary:
    "border border-line bg-white text-plum-900 hover:bg-surface focus-visible:ring-plum-400/25",
  ghost:
    "bg-transparent text-slate-500 underline-offset-4 hover:text-plum-900 hover:underline focus-visible:ring-plum-400/25",
  danger:
    "bg-danger-text text-white hover:bg-danger-text/90 focus-visible:ring-danger-text/30",
};

/**
 * Tombol bersama. Varian `primary` untuk aksi utama (Masuk, Simpan);
 * `secondary` untuk aksi sekunder; `ghost` untuk tautan-seperti; `danger`
 * untuk penolakan atau penghapusan yang perlu penekanan.
 */
export function Button({
  variant = "primary",
  className,
  children,
  type = "button",
  ...props
}: {
  variant?: ButtonVariant;
  children: ReactNode;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-card px-4 py-2 font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60",
        VARIANT[variant],
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}
