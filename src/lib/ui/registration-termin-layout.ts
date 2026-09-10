/**
 * Kontrak tata letak F05-T05 / #59 (form daftar project + jadwal termin).
 *
 * Modul ini sengaja murni (tanpa React/Prisma) supaya #74 mengisi form termin
 * tanpa menggeser keputusan: nomor terbit dulu, skema termin menyusul di hub.
 * Perubahan layout harus lewat review dokumen
 * `docs/wireframes/F05-F13-registration-termin.md` dulu.
 */

import type { Action } from "@/lib/auth/types";

export type RegistrationFieldKey = "name" | "clientId" | "period" | "value";

export interface RegistrationField {
  key: RegistrationFieldKey;
  label: string;
  required: boolean;
  control: "text" | "select" | "number";
  note?: string;
}

/**
 * Isian form daftar. UAT-PRJ-001 menyebut jenis, PM, scope, dan termin —
 * itu tidak masuk backend F05, jadi tidak dikunci di sini.
 */
export const REGISTRATION_FIELDS: readonly RegistrationField[] = [
  {
    key: "name",
    label: "Nama project",
    required: true,
    control: "text",
  },
  {
    key: "clientId",
    label: "Client",
    required: true,
    control: "select",
    note: "Dipilih dari master data F06, bukan diketik ulang.",
  },
  {
    key: "period",
    label: "Periode",
    required: true,
    control: "text",
    note: "Empat digit; masuk ke nomor IIT-{period}-NNN.",
  },
  {
    key: "value",
    label: "Nilai project",
    required: false,
    control: "number",
    note: "Opsional saat daftar; wajib sebelum skema termin bisa disimpan.",
  },
] as const;

/** Field yang sengaja tidak ada di form create, supaya tidak dikarang belakangan. */
export const REGISTRATION_CREATE_EXCLUSIONS = [
  "jenis",
  "pm",
  "scope",
  "termin",
  "overrideId",
] as const;

export type RegistrationCreateExclusion =
  (typeof REGISTRATION_CREATE_EXCLUSIONS)[number];

export type AfterIdActionKey =
  | "compose_termin"
  | "open_hub"
  | "register_another";

export interface AfterIdAction {
  key: AfterIdActionKey;
  label: string;
  href: "/projects/baru" | "/projects/{projectId}";
  requires: Action | null;
}

export const AFTER_ID_ACTIONS: readonly AfterIdAction[] = [
  {
    key: "compose_termin",
    label: "Susun jadwal termin",
    href: "/projects/{projectId}",
    requires: "project.edit_operational",
  },
  {
    key: "open_hub",
    label: "Buka Project Hub",
    href: "/projects/{projectId}",
    requires: null,
  },
  {
    key: "register_another",
    label: "Daftarkan project lain",
    href: "/projects/baru",
    requires: "project.create",
  },
] as const;

export type TerminFormPlacement = {
  surface: "hub";
  section: "termin";
  route: "/projects/[projectId]";
};

/** Form termin mengisi slot F08, bukan halaman baru. */
export const TERMIN_FORM_PLACEMENT: TerminFormPlacement = {
  surface: "hub",
  section: "termin",
  route: "/projects/[projectId]",
};

export type TerminRowFieldKey =
  | "sequence"
  | "percentage"
  | "amount"
  | "dueDate"
  | "label";

export interface TerminRowField {
  key: TerminRowFieldKey;
  label: string;
  required: boolean;
  note?: string;
}

export const TERMIN_ROW_FIELDS: readonly TerminRowField[] = [
  {
    key: "sequence",
    label: "Nomor",
    required: true,
    note: "1 = uang muka. Diisi form berurutan, bukan diketik bebas.",
  },
  {
    key: "percentage",
    label: "Persentase",
    required: false,
    note: "Wajib salah satu dari persentase atau nominal.",
  },
  {
    key: "amount",
    label: "Nominal",
    required: false,
    note: "Wajib salah satu dari persentase atau nominal.",
  },
  {
    key: "dueDate",
    label: "Jatuh tempo",
    required: true,
  },
  {
    key: "label",
    label: "Label",
    required: false,
  },
] as const;

export type TerminLiveCheckKey = "total_percent" | "dp_range";

export interface TerminLiveCheck {
  key: TerminLiveCheckKey;
  label: string;
  /** Syarat lolos umpan balik langsung; server memakai aturan yang sama. */
  okWhen: string;
}

export const TERMIN_LIVE_CHECKS: readonly TerminLiveCheck[] = [
  {
    key: "total_percent",
    label: "Jumlah persentase",
    okWhen: "tepat 100.00",
  },
  {
    key: "dp_range",
    label: "Uang muka (termin 1)",
    okWhen: "25 sampai 50 inklusif",
  },
] as const;

export function registrationRequiredKeys(): RegistrationFieldKey[] {
  return REGISTRATION_FIELDS.filter((field) => field.required).map(
    (field) => field.key,
  );
}

export function terminRequiredRowKeys(): TerminRowFieldKey[] {
  return TERMIN_ROW_FIELDS.filter((field) => field.required).map(
    (field) => field.key,
  );
}
