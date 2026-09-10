/**
 * Kontrak tampilan F15-T03 (antrean Finance + rincian pengajuan).
 *
 * Modul ini murni: tanpa React/Prisma. Halaman sungguhan ditulis di F15-T02
 * (#77) dan tombol setuju/tolak di F17-T04 (#85). Perubahan layout harus lewat
 * review dokumen `docs/wireframes/F15-finance-queue.md` dulu.
 *
 * Slot nav `finance_queue` dipesan F08-T02 dan diisi `now` oleh F15-T02 (#77).
 */

import { can } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import type { TerminChainState } from "@/lib/finance/chain";
import type {
  FinanceQueueItem,
  InvoiceQueueStatus,
  PaymentQueueStatus,
} from "@/lib/finance/queue";

/** Rute antrean. Sama dengan href nav `finance_queue`. */
export const FINANCE_QUEUE_HREF = "/finance/antrean";

/** Rincian satu pengajuan. Tombol setuju/tolak mengisi halaman ini di #85. */
export const FINANCE_SUBMISSION_DETAIL_ROUTE =
  "/finance/pengajuan/[submissionId]" as const;

export function financeSubmissionHref(submissionId: string): string {
  return `/finance/pengajuan/${encodeURIComponent(submissionId)}`;
}

export type FinanceQueueColumnKey =
  | "documentNumber"
  | "projectId"
  | "clientName"
  | "amount"
  | "dueDate"
  | "approvalStatus"
  | "paymentStatus"
  | "holdingLabel"
  | "waitingWorkingMinutes";

export interface FinanceQueueColumn {
  key: FinanceQueueColumnKey;
  label: string;
}

/**
 * Kolom F15-AC1 / UAT-FIN-001. Urutannya dikunci supaya #77 tidak menambah
 * kolom di tengah atau menghilangkan lama menunggu.
 */
export const FINANCE_QUEUE_COLUMNS: readonly FinanceQueueColumn[] = [
  { key: "documentNumber", label: "Nomor dokumen" },
  { key: "projectId", label: "Project ID" },
  { key: "clientName", label: "Client" },
  { key: "amount", label: "Nominal" },
  { key: "dueDate", label: "Jatuh tempo" },
  { key: "approvalStatus", label: "Status approval" },
  { key: "paymentStatus", label: "Status pembayaran" },
  { key: "holdingLabel", label: "Sedang menunggu" },
  { key: "waitingWorkingMinutes", label: "Lama menunggu" },
] as const;

export type FinanceQueueKindFilter = "all" | "invoice" | "receipt";
export type FinanceQueueStatusFilter =
  | "all"
  | "MENUNGGU_PERSETUJUAN"
  | "MENUNGGU_PEMBAYARAN"
  | "MENUNGGU_VERIFIKASI";

export interface FinanceQueueFilterOption<T extends string> {
  value: T;
  label: string;
}

/** Penyaring jenis F15-T02: invoice vs kuitansi, bukan staffing. */
export const FINANCE_QUEUE_KIND_FILTERS: readonly FinanceQueueFilterOption<FinanceQueueKindFilter>[] =
  [
    { value: "all", label: "Semua jenis" },
    { value: "invoice", label: "Invoice" },
    { value: "receipt", label: "Kuitansi" },
  ];

/** Penyaring status F15-T02, memakai kata keadaan rantai yang sama. */
export const FINANCE_QUEUE_STATUS_FILTERS: readonly FinanceQueueFilterOption<FinanceQueueStatusFilter>[] =
  [
    { value: "all", label: "Semua status" },
    { value: "MENUNGGU_PERSETUJUAN", label: "Menunggu persetujuan" },
    { value: "MENUNGGU_PEMBAYARAN", label: "Menunggu pembayaran" },
    { value: "MENUNGGU_VERIFIKASI", label: "Menunggu verifikasi" },
  ];

export type FinanceQueueKind = "invoice" | "receipt";

/**
 * Jenis baris menurut keadaannya.
 *
 * Invoice yang masih di rantai atau sudah disetujui tetapi belum dibayar
 * adalah dokumen invoice. Bukti transfer yang menunggu validasi adalah
 * dokumen kuitansi. Keadaan lain tidak pernah masuk antrean.
 */
export function queueKindOf(state: TerminChainState): FinanceQueueKind | null {
  if (state === "MENUNGGU_VERIFIKASI") return "receipt";
  if (state === "MENUNGGU_PERSETUJUAN" || state === "MENUNGGU_PEMBAYARAN") {
    return "invoice";
  }
  return null;
}

export function matchesFinanceQueueFilters(
  item: Pick<FinanceQueueItem, "state">,
  filters: {
    kind: FinanceQueueKindFilter;
    status: FinanceQueueStatusFilter;
  },
): boolean {
  if (filters.status !== "all" && item.state !== filters.status) return false;
  if (filters.kind === "all") return true;
  return queueKindOf(item.state) === filters.kind;
}

export type FinanceSubmissionSectionKey =
  | "document"
  | "waiting"
  | "chain"
  | "decision";

export interface FinanceSubmissionSection {
  key: FinanceSubmissionSectionKey;
  title: string;
  summary: string;
}

/**
 * Rincian pengajuan (UAT-FIN-002 + F17). Section `decision` dikunci di sini
 * supaya #85 tidak membuat tombol setuju/tolak di baris antrean.
 */
export const FINANCE_SUBMISSION_SECTIONS: readonly FinanceSubmissionSection[] =
  [
    {
      key: "document",
      title: "Dokumen",
      summary:
        "Nomor dokumen, Project ID, client, nominal, jatuh tempo, status approval dan pembayaran.",
    },
    {
      key: "waiting",
      title: "Sedang menunggu",
      summary:
        "Pemegang langkah, waktu masuk pengajuan, dan lama menunggu dalam jam kerja.",
    },
    {
      key: "chain",
      title: "Rantai persetujuan",
      summary:
        "Langkah yang ditentukan sistem, bukan dipilih pengaju. Riwayat keputusan tetap terlihat.",
    },
    {
      key: "decision",
      title: "Keputusan",
      summary:
        "Setujui atau tolak. Penolakan wajib mengisi alasan. Diisi F17-T04, bukan di baris antrean.",
    },
  ];

export const FINANCE_SUBMISSION_DECISION_PLACEMENT = {
  surface: "detail",
  route: FINANCE_SUBMISSION_DETAIL_ROUTE,
  rejectReasonRequired: true,
} as const;

function firstQueryValue(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

/**
 * Membaca penyaring dari query string. Nilai yang tidak dikenal jatuh ke semua,
 * supaya tautan usang tidak mengosongkan antrean diam-diam.
 */
export function parseFinanceQueueSearchParams(input: {
  jenis?: string | string[];
  status?: string | string[];
}): {
  kind: FinanceQueueKindFilter;
  status: FinanceQueueStatusFilter;
} {
  const jenis = firstQueryValue(input.jenis);
  const status = firstQueryValue(input.status);
  const kind = FINANCE_QUEUE_KIND_FILTERS.some(
    (option) => option.value === jenis,
  )
    ? (jenis as FinanceQueueKindFilter)
    : "all";
  const statusFilter = FINANCE_QUEUE_STATUS_FILTERS.some(
    (option) => option.value === status,
  )
    ? (status as FinanceQueueStatusFilter)
    : "all";
  return { kind, status: statusFilter };
}

export function filterFinanceQueueItems<
  T extends Pick<FinanceQueueItem, "state">,
>(
  items: readonly T[],
  filters: {
    kind: FinanceQueueKindFilter;
    status: FinanceQueueStatusFilter;
  },
): T[] {
  return items.filter((item) => matchesFinanceQueueFilters(item, filters));
}

export function financeApprovalLabel(status: InvoiceQueueStatus): string {
  switch (status) {
    case "PENDING":
      return "Menunggu";
    case "APPROVED":
      return "Disetujui";
    case "REJECTED":
      return "Ditolak";
  }
}

export function financePaymentLabel(status: PaymentQueueStatus): string {
  switch (status) {
    case "BELUM":
      return "Belum dibayar";
    case "MENUNGGU":
      return "Menunggu pembayaran";
    case "RECORDED":
      return "Bukti tercatat";
    case "LUNAS":
      return "Lunas";
  }
}

export function financeHoldingDisplay(
  item: Pick<FinanceQueueItem, "holdingLabel" | "state">,
): string {
  if (item.holdingLabel) return item.holdingLabel;
  if (item.state === "MENUNGGU_PEMBAYARAN") return "Pembayaran";
  return "—";
}

/** Pintu tampilan antrean sama dengan izin bacanya di server: `finance.view`. */
export function canSeeFinanceQueue(
  actor: Actor,
  now: Date = new Date(),
): boolean {
  return can({ actor, action: "finance.view", now });
}
