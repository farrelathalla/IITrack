import { activeAssignments } from "@/lib/auth/period";
import type { Actor, RoleName } from "@/lib/auth/types";

/**
 * Penyusun rantai persetujuan (F17).
 *
 * Rantai ditentukan sistem dari jenis pengajuan dan jabatan, bukan dipilih
 * pengaju. Berkas ini murni dan tidak menyentuh basis data, karena aturannya
 * dipanggil pada setiap pengajuan dan setiap keputusan.
 */

/**
 * Jenis pengajuan yang rantainya sudah ditetapkan PRD bab 3.3.
 *
 * Jenis lain seperti pencairan dana dan penggantian biaya sengaja belum
 * dicantumkan, karena rantainya belum tertulis di dokumen mana pun. Menambahkan
 * jenis baru berarti menambah satu entri di bawah, dan pemakainya tidak berubah.
 */
export type SubmissionType =
  | "INVOICE"
  | "STAFFING_REQUEST"
  | "PROJECT_VALUE_CHANGE";

export interface ApprovalStepSpec {
  /** Urutan langkah, mulai dari 1 tanpa lompatan. */
  order: number;
  /** Jabatan yang boleh memutuskan langkah ini. Satu di antaranya sudah cukup. */
  eligibleRoles: readonly RoleName[];
  /** Nama langkah yang dibaca pengguna. */
  label: string;
}

/**
 * Rantai per jenis pengajuan, menyalin PRD bab 3.3.
 *
 * Catatan untuk DEP-02: PRD menyebut langkah kedua invoice sebagai "Internal
 * POC dokumentasi" tanpa memetakannya ke jabatan yang ada pada Tabel 1. Di sini
 * dipetakan ke Officer Operational sebagai penafsiran paling dekat. Pemetaan
 * ini masih perlu konfirmasi tertulis bersama Role-Permission Matrix Finance
 * dan TechDev.
 */
export const APPROVAL_CHAINS: Record<
  SubmissionType,
  readonly ApprovalStepSpec[]
> = {
  INVOICE: Object.freeze([
    {
      order: 1,
      eligibleRoles: Object.freeze(["FINANCE_POC"] as const),
      label: "Finance POC",
    },
    {
      order: 2,
      eligibleRoles: Object.freeze(["OFFICER_OPERATIONAL"] as const),
      label: "POC dokumentasi",
    },
    {
      order: 3,
      eligibleRoles: Object.freeze(["CFO", "VICE_CFO"] as const),
      label: "CFO atau Vice CFO",
    },
  ]),

  STAFFING_REQUEST: Object.freeze([
    {
      order: 1,
      eligibleRoles: Object.freeze(["CTO", "VICE_CTO"] as const),
      label: "CTO atau Vice CTO",
    },
  ]),

  PROJECT_VALUE_CHANGE: Object.freeze([
    {
      order: 1,
      eligibleRoles: Object.freeze(["COO", "VICE_COO"] as const),
      label: "COO atau Vice COO",
    },
  ]),
};

/** Rantai persetujuan untuk sebuah jenis pengajuan. */
export function buildApprovalChain(
  type: SubmissionType,
): readonly ApprovalStepSpec[] {
  return APPROVAL_CHAINS[type];
}

/** Jabatan yang berwenang pada satu langkah, kosong bila langkahnya tidak ada. */
export function eligibleRolesForStep(
  type: SubmissionType,
  order: number,
): readonly RoleName[] {
  return (
    buildApprovalChain(type).find((step) => step.order === order)
      ?.eligibleRoles ?? []
  );
}

/**
 * Apakah seseorang berwenang memutuskan sebuah langkah.
 *
 * Jabatan saja tidak cukup: jabatannya harus masih berlaku pada saat keputusan
 * diambil, dan akunnya harus aktif. Tanpa itu, pengurus yang masa jabatannya
 * sudah habis masih bisa menyetujui pengajuan.
 */
export function isEligibleApprover(
  candidate: Actor,
  step: ApprovalStepSpec,
  now: Date,
): boolean {
  if (candidate.status !== "ACTIVE") return false;

  return activeAssignments(candidate.roleAssignments, now).some((assignment) =>
    step.eligibleRoles.includes(assignment.role),
  );
}
