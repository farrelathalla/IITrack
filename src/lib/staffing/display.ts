/**
 * Kontrak tampilan F14-T03 (form permintaan + antrean CTO).
 *
 * Modul ini murni: tanpa React/Prisma. Form tetap di panel Tim hub (bukan item
 * nav baru), dan halaman CTO memakai `staffing.approve` — bukan `techdev.view`,
 * karena PM juga punya techdev.view secara global.
 */

import { can } from "@/lib/auth/permissions";
import type { Actor, Division, ProjectContext } from "@/lib/auth/types";

/** Rute antrean CTO. Sengaja tidak masuk `PLANNED_MAIN_NAV`. */
export const STAFFING_QUEUE_HREF = "/techdev/antrean";

export const STAFFING_FORM_PLACEMENT = {
  surface: "hub",
  section: "team",
} as const;

export type StaffingRequestFieldKey =
  | "roleNeeded"
  | "headcount"
  | "neededBy"
  | "technicalNeeds"
  | "deliverable";

export interface StaffingRequestField {
  key: StaffingRequestFieldKey;
  label: string;
  required: true;
  control: "text" | "number" | "date" | "textarea";
}

/** Isian UAT-SDM-001 / F14-AC1. Project ID datang dari hub yang dibuka. */
export const STAFFING_REQUEST_FIELDS: readonly StaffingRequestField[] = [
  {
    key: "roleNeeded",
    label: "Jabatan yang dibutuhkan",
    required: true,
    control: "text",
  },
  {
    key: "headcount",
    label: "Jumlah orang",
    required: true,
    control: "number",
  },
  {
    key: "neededBy",
    label: "Tanggal dibutuhkan",
    required: true,
    control: "date",
  },
  {
    key: "technicalNeeds",
    label: "Kebutuhan teknis",
    required: true,
    control: "textarea",
  },
  {
    key: "deliverable",
    label: "Deliverable",
    required: true,
    control: "textarea",
  },
];

export function staffingStatusLabel(status: string): string {
  switch (status) {
    case "SUBMITTED":
      return "Diajukan";
    case "FULFILLED":
      return "Ditetapkan";
    case "REJECTED":
      return "Ditolak";
    default:
      return status;
  }
}

/**
 * Konteks palsu hanya untuk melewati syarat "aksi ini butuh project".
 * CTO punya `staffing.approve` secara global, jadi daftar divisi boleh kosong.
 */
const QUEUE_SCOPE: ProjectContext = {
  projectId: "*",
  assignedDivisions: [] as Division[],
};

/** Tombol/tautan antrean: CTO dan Vice CTO, bukan siapa pun yang techdev.view. */
export function canSeeStaffingQueue(
  actor: Actor,
  now: Date = new Date(),
): boolean {
  return can({
    actor,
    action: "staffing.approve",
    project: QUEUE_SCOPE,
    now,
  });
}

/** Form pengajuan: hanya PM yang ditugaskan pada project itu. */
export function canSeeStaffingRequestForm(
  actor: Actor,
  project: ProjectContext,
  now: Date = new Date(),
): boolean {
  return can({
    actor,
    action: "staffing.request",
    project,
    now,
  });
}
