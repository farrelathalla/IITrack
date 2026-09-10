import type { Division, RoleName } from "@/lib/auth/types";

export const ROLE_OPTIONS: readonly { value: RoleName; label: string }[] = [
  { value: "COO", label: "COO" },
  { value: "VICE_COO", label: "Vice COO" },
  { value: "CFO", label: "CFO" },
  { value: "VICE_CFO", label: "Vice CFO" },
  { value: "CTO", label: "CTO" },
  { value: "VICE_CTO", label: "Vice CTO" },
  { value: "PROJECT_MANAGER", label: "Project Manager" },
  { value: "FINANCE_POC", label: "Finance POC" },
  { value: "OFFICER_OPERATIONAL", label: "Officer Operational" },
  { value: "TECHDEV_MEMBER", label: "TechDev Member" },
];

export const DIVISION_OPTIONS: readonly {
  value: Division;
  label: string;
}[] = [
  { value: "OPERATIONAL", label: "Operational" },
  { value: "FINANCE", label: "Finance" },
  { value: "TECHDEV", label: "TechDev" },
];

/** Divisi bawaan menurut jabatan — bisa diganti manual di formulir. */
export function defaultDivisionForRole(role: RoleName): Division {
  switch (role) {
    case "CFO":
    case "VICE_CFO":
    case "FINANCE_POC":
      return "FINANCE";
    case "CTO":
    case "VICE_CTO":
    case "TECHDEV_MEMBER":
      return "TECHDEV";
    default:
      return "OPERATIONAL";
  }
}

/**
 * Membaca tanggal dari `<input type="date">` (YYYY-MM-DD) sebagai tengah malam
 * WIB, supaya stempelnya tidak bergeser ke hari sebelumnya di UTC murni.
 */
export function parseDateInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}T00:00:00+07:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function formatDateId(value: Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}
