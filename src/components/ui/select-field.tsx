"use client";

import type { ReactNode, SelectHTMLAttributes } from "react";
import { useId } from "react";
import { FieldError } from "@/components/ui/alert";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { cn } from "@/lib/utils";

/**
 * Select native bermerk IIT. Opsi diisi pemanggil sebagai children.
 *
 * ID kontrol memakai `useId` (bukan `name`) supaya dua formulir di halaman
 * yang sama tidak bentrok, dan supaya hidrasi tidak gagal karena autofill /
 * state browser mengubah `<select>` sebelum React siap.
 */
export function SelectField({
  label,
  error,
  hint,
  className,
  id,
  children,
  ...props
}: {
  label: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
} & SelectHTMLAttributes<HTMLSelectElement>) {
  const generatedId = useId();
  const controlId = id ?? generatedId;

  return (
    <label className="flex flex-col gap-1.5" htmlFor={controlId}>
      <span className="font-medium text-plum-900">{label}</span>
      <select
        {...props}
        id={controlId}
        aria-invalid={error ? true : undefined}
        className={cn(FIELD_CONTROL, className)}
        // Autofill / restore form browser bisa mengubah nilai sebelum hydrate.
        suppressHydrationWarning
      >
        {children}
      </select>
      {hint && !error ? (
        <span className="text-slate-500 text-xs">{hint}</span>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </label>
  );
}
