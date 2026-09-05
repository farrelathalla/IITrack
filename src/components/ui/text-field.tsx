import type { InputHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const INPUT =
  "rounded-card border border-line bg-white px-3 py-2 text-ink outline-none focus:border-plum-400 focus:ring-2 focus:ring-plum-400/25";

/**
 * Label + input teks yang dipakai berulang di formulir. Gaya field dipusatkan
 * di sini supaya halaman tidak menyalin konstanta Tailwind (Design Brief bab 5).
 */
export function TextField({
  label,
  className,
  ...props
}: {
  label: ReactNode;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="font-medium text-plum-900">{label}</span>
      <input {...props} className={cn(INPUT, className)} />
    </label>
  );
}
