import type { ReactNode, TextareaHTMLAttributes } from "react";
import { FieldError } from "@/components/ui/alert";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { cn } from "@/lib/utils";

/** Area teks bermerk IIT, pasangan TextField untuk catatan dan alasan. */
export function TextArea({
  label,
  error,
  hint,
  className,
  id,
  rows = 4,
  ...props
}: {
  label: ReactNode;
  error?: ReactNode;
  hint?: ReactNode;
  className?: string;
} & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const controlId = id ?? props.name;

  return (
    <label className="flex flex-col gap-1.5" htmlFor={controlId}>
      <span className="font-medium text-plum-900">{label}</span>
      <textarea
        {...props}
        id={controlId}
        rows={rows}
        aria-invalid={error ? true : undefined}
        className={cn(FIELD_CONTROL, "min-h-24 resize-y", className)}
      />
      {hint && !error ? (
        <span className="text-slate-500 text-xs">{hint}</span>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </label>
  );
}
