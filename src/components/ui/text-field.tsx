import type { InputHTMLAttributes, ReactNode } from "react";
import { FieldError } from "@/components/ui/alert";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { cn } from "@/lib/utils";

/**
 * Label + input teks yang dipakai berulang di formulir. Gaya field dipusatkan
 * di sini supaya halaman tidak menyalin konstanta Tailwind (Design Brief bab 5).
 */
export function TextField({
  label,
  error,
  hint,
  className,
  id,
  ...props
}: {
  label: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  className?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  const controlId = id ?? props.name;

  return (
    <label className="flex flex-col gap-1.5" htmlFor={controlId}>
      <span className="font-medium text-plum-900">{label}</span>
      <input
        {...props}
        id={controlId}
        aria-invalid={error ? true : undefined}
        className={cn(FIELD_CONTROL, className)}
      />
      {hint && !error ? (
        <span className="text-slate-500 text-xs">{hint}</span>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </label>
  );
}
