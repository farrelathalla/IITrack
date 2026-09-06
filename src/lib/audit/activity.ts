/**
 * Kalimat jejak aktivitas untuk tampilan (F24-T03).
 *
 * Panel hub tidak boleh menampilkan kunci aksi mentah atau JSON before/after.
 * Pemformatan murni di sini supaya daftarnya bisa diuji tanpa Prisma.
 */

import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { findStage, STAGE_CATALOGUE } from "@/lib/project/stages";

/** UI riwayat tidak menyediakan hapus — jejak append-only (UAT-HIST-005). */
export const ACTIVITY_LIST_ALLOWS_DELETE = false;

const HEADLINES: Record<string, string> = {
  [AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS]: "Berhasil masuk",
  [AUDIT_ACTIONS.AUTH_LOGIN_FAILED]: "Percobaan masuk ditolak",
  [AUDIT_ACTIONS.AUTH_LOGOUT]: "Keluar",
  [AUDIT_ACTIONS.SESSION_REVOKED_AUTOMATIC]: "Sesi dicabut otomatis",
  [AUDIT_ACTIONS.SESSION_REVOKED_BY_ADMIN]: "Sesi dicabut pengurus",
  [AUDIT_ACTIONS.PROJECT_CREATED]: "Project didaftarkan",
  [AUDIT_ACTIONS.PROJECT_ID_OVERRIDDEN]: "Project ID ditetapkan ulang",
  [AUDIT_ACTIONS.PROJECT_STAGE_CHANGED]: "Tahap diganti",
  [AUDIT_ACTIONS.PROJECT_PM_ASSIGNED]: "PM ditugaskan",
  [AUDIT_ACTIONS.MEMBER_ROLE_ASSIGNED]: "Jabatan ditetapkan",
  [AUDIT_ACTIONS.MEMBER_ROLE_PERIOD_OVERRIDDEN]: "Masa jabatan diubah",
  [AUDIT_ACTIONS.MEMBER_HANDOVER]: "Serah terima jabatan",
  [AUDIT_ACTIONS.USER_DEACTIVATED]: "Akun dinonaktifkan",
  [AUDIT_ACTIONS.SUBMISSION_CREATED]: "Pengajuan dibuat",
  [AUDIT_ACTIONS.SUBMISSION_STEP_APPROVED]: "Pengajuan disetujui",
  [AUDIT_ACTIONS.SUBMISSION_STEP_REJECTED]: "Pengajuan ditolak",
  [AUDIT_ACTIONS.SUBMISSION_REVISED]: "Pengajuan diperbaiki",
  [AUDIT_ACTIONS.PROJECT_MEMBER_ASSIGNED]: "Pelaksana ditugaskan",
  [AUDIT_ACTIONS.PROJECT_MEMBER_UNASSIGNED]: "Pelaksana dilepas",
  [AUDIT_ACTIONS.STAFFING_REQUESTED]: "Permintaan tenaga diajukan",
  [AUDIT_ACTIONS.STAFFING_FULFILLED]: "Permintaan tenaga dipenuhi",
  [AUDIT_ACTIONS.REFERENCE_ADDED]: "Tautan ditambahkan",
  [AUDIT_ACTIONS.TERMIN_SCHEME_SAVED]: "Skema termin disimpan",
  [AUDIT_ACTIONS.CLIENT_CREATED]: "Client ditambahkan",
  [AUDIT_ACTIONS.CLIENT_UPDATED]: "Data client diubah",
};

const FIELD_LABEL: Record<string, string> = {
  stage: "Tahap",
  projectId: "Project ID",
  nama: "Nama",
  client: "Client",
  status: "Status",
  langkah: "Langkah",
  revisi: "Revisi",
  jenis: "Jenis",
  divisi: "Divisi",
  label: "Label",
  url: "Tautan",
  slaTerpenuhi: "SLA",
  termin: "Skema",
};

const HIDDEN_KEYS = new Set([
  "assignedPmId",
  "pelaksana",
  "objectId",
  "userId",
  "changedById",
  "slaMenitKerja",
]);

export type ActivityItem = {
  headline: string;
  change: string | null;
  reason: string | null;
  actorName: string | null;
  at: Date;
};

export function summarizeAuditAction(action: string): string {
  return HEADLINES[action] ?? action.replaceAll(".", " · ");
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function readableStage(value: unknown): string {
  if (value === null || value === undefined || value === "") {
    return "Belum ditetapkan";
  }
  const key = String(value);
  return findStage(STAGE_CATALOGUE, key)?.label ?? key;
}

function formatFieldValue(key: string, value: unknown): string | null {
  if (HIDDEN_KEYS.has(key)) return null;
  if (key === "stage") return readableStage(value);
  if (value === null || value === undefined) return "—";
  if (key === "slaTerpenuhi") {
    return value === true ? "tepat waktu" : "terlampaui";
  }
  if (Array.isArray(value)) {
    if (key === "termin") return `${value.length} termin`;
    if (value.every((item) => typeof item === "string")) {
      return value.join(", ");
    }
    return `${value.length} item`;
  }
  if (typeof value === "object") return null;
  if (typeof value === "boolean") return value ? "ya" : "tidak";
  return String(value);
}

function fieldLabel(key: string): string {
  return FIELD_LABEL[key] ?? key;
}

/**
 * Ringkas selisih before/after jadi satu baris. Bukan dump JSON.
 */
export function describeAuditChange(
  before: unknown,
  after: unknown,
): string | null {
  const lama = asRecord(before) ?? {};
  const baru = asRecord(after) ?? {};
  const keys = [...new Set([...Object.keys(lama), ...Object.keys(baru)])];
  const parts: string[] = [];

  for (const key of keys) {
    if (HIDDEN_KEYS.has(key)) continue;
    const left = Object.hasOwn(lama, key)
      ? formatFieldValue(key, lama[key])
      : null;
    const right = Object.hasOwn(baru, key)
      ? formatFieldValue(key, baru[key])
      : null;
    if (left === null && right === null) continue;
    if (left === right) continue;

    const label = fieldLabel(key);
    if (left && right) {
      parts.push(`${label}: ${left} → ${right}`);
    } else {
      parts.push(`${label}: ${right ?? left}`);
    }
  }

  return parts.length > 0 ? parts.join(" · ") : null;
}

export function toActivityItem(entry: {
  action: string;
  actorName: string | null;
  reason: string | null;
  createdAt: Date;
  before?: unknown;
  after?: unknown;
}): ActivityItem {
  return {
    headline: summarizeAuditAction(entry.action),
    change: describeAuditChange(entry.before, entry.after),
    reason:
      entry.reason && entry.reason.trim().length > 0 ? entry.reason : null,
    actorName: entry.actorName,
    at: entry.createdAt,
  };
}
