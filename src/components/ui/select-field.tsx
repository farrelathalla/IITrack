import type { ReactNode, SelectHTMLAttributes } from "react";
import { FieldError } from "@/components/ui/alert";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { cn } from "@/lib/utils";

/** Select native bermerk IIT. Opsi diisi pemanggil sebagai children. */
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
  const controlId = id ?? props.name;

  return (
    <label className="flex flex-col gap-1.5" htmlFor={controlId}>
      <span className="font-medium text-plum-900">{label}</span>
      <select
        {...props}
        id={controlId}
        aria-invalid={error ? true : undefined}
        className={cn(FIELD_CONTROL, className)}
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
