"use client";

import { Button, SelectField } from "@/components/ui";
import {
  FINANCE_QUEUE_HREF,
  FINANCE_QUEUE_KIND_FILTERS,
  FINANCE_QUEUE_STATUS_FILTERS,
  type FinanceQueueKindFilter,
  type FinanceQueueStatusFilter,
} from "@/lib/finance/display";

/**
 * Penyaring GET. SelectField menekan peringatan hidrasi karena restore
 * form browser bisa mengubah nilai sebelum React siap (pola yang sama di
 * `/pengurus`).
 */
export function FinanceQueueFilters({
  kind,
  status,
}: {
  kind: FinanceQueueKindFilter;
  status: FinanceQueueStatusFilter;
}) {
  return (
    <form
      method="get"
      action={FINANCE_QUEUE_HREF}
      className="flex flex-wrap items-end gap-4"
      autoComplete="off"
    >
      <SelectField
        label="Jenis"
        name="jenis"
        defaultValue={kind}
        className="min-w-48"
      >
        {FINANCE_QUEUE_KIND_FILTERS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <SelectField
        label="Status"
        name="status"
        defaultValue={status}
        className="min-w-56"
      >
        {FINANCE_QUEUE_STATUS_FILTERS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>
      <Button type="submit" variant="secondary">
        Terapkan
      </Button>
    </form>
  );
}
