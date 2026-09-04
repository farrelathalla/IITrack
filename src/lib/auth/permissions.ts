import {
  FORBIDDEN_ACTIONS,
  ROLE_CAPABILITIES,
  SYSTEM_ADMIN_CAPABILITIES,
} from "./capabilities";
import type {
  Action,
  PermissionDecision,
  PermissionQuery,
  RoleAssignment,
} from "./types";

const ALLOWED: PermissionDecision = { allowed: true };

function deny(reason: string): PermissionDecision {
  return { allowed: false, reason };
}

/**
 * Aksi yang hanya bermakna di dalam satu project. Tanpa konteks project, aksi
 * ini ditolak alih-alih diloloskan, supaya permintaan langsung ke server tidak
 * bisa melewati pemeriksaan dengan cara menghilangkan konteksnya.
 */
const PROJECT_SCOPED_ACTIONS: ReadonlySet<Action> = new Set<Action>([
  "project.view_value",
  "project.edit_operational",
  "project.assign_member",
  "project.override_id",
  "stage.change",
  "gate.override",
  "finance.edit",
  "finance.submit",
  "finance.approve_final",
  "techdev.edit",
  "staffing.request",
  "staffing.approve",
  "approval.project_value_scope",
  "approval.p0_second_confirmation",
]);

function isWithinPeriod(assignment: RoleAssignment, now: Date): boolean {
  if (now.getTime() < assignment.startDate.getTime()) return false;
  if (assignment.endDate === null) return true;
  return now.getTime() < assignment.endDate.getTime();
}

/**
 * Penentu izin IITrack (F03).
 *
 * Fungsi ini murni: tidak menyentuh basis data, sesi, maupun request. Seluruh
 * fitur memanggilnya dan tidak ada fitur yang memeriksa izin dengan caranya
 * sendiri, sesuai titik integrasi pada Pembagian Kerja bab 5.
 */
export function checkPermission(query: PermissionQuery): PermissionDecision {
  const { actor, action, project, now } = query;

  if (FORBIDDEN_ACTIONS.includes(action)) {
    return deny(
      "Catatan jejak aktivitas tidak dapat dihapus oleh jabatan mana pun, termasuk pemegang System Administrator privilege.",
    );
  }

  if (actor.status === "INVITED") {
    return deny(
      "Akun Anda belum diaktifkan. Selesaikan aktivasi dari tautan undangan terlebih dahulu.",
    );
  }

  if (actor.status === "DEACTIVATED") {
    return deny(
      "Akun Anda sudah dinonaktifkan. Hubungi pengurus TechDev yang memegang wewenang administrasi akun.",
    );
  }

  const activeAssignments = actor.roleAssignments.filter((a) =>
    isWithinPeriod(a, now),
  );

  if (activeAssignments.length === 0) {
    return deny(
      "Masa jabatan Anda sudah berakhir atau belum dimulai, sehingga tidak ada kewenangan yang berlaku. Minta pengurus TechDev memperbarui periode jabatan Anda bila ini keliru.",
    );
  }

  const needsProject = PROJECT_SCOPED_ACTIONS.has(action);
  if (needsProject && !project) {
    return deny(
      "Tindakan ini hanya bisa dilakukan dari dalam sebuah project. Buka project yang dimaksud terlebih dahulu.",
    );
  }

  for (const assignment of activeAssignments) {
    if (
      assignment.isSystemAdmin &&
      SYSTEM_ADMIN_CAPABILITIES.includes(action)
    ) {
      return ALLOWED;
    }

    const capability = ROLE_CAPABILITIES[assignment.role];

    if (capability.global.includes(action)) {
      return ALLOWED;
    }

    // Hak edit lahir dari penugasan project ditambah domain divisi, bukan dari
    // pengaturan izin manual per project (PRD bab 3.2).
    const isAssignedInOwnDomain =
      project?.assignedDivisions.includes(assignment.division) ?? false;

    if (isAssignedInOwnDomain && capability.assigned.includes(action)) {
      return ALLOWED;
    }
  }

  if (needsProject && project && project.assignedDivisions.length === 0) {
    return deny(
      "Anda bukan pelaksana yang ditugaskan pada project ini, jadi datanya hanya bisa dilihat. Minta COO menugaskan Anda bila perlu mengubahnya.",
    );
  }

  return deny(
    "Jabatan Anda tidak memiliki wewenang untuk tindakan ini. Ajukan kepada pemegang jabatan yang berwenang di domain tersebut.",
  );
}

/** Bentuk ringkas `checkPermission` untuk pemakaian di kondisional. */
export function can(query: PermissionQuery): boolean {
  return checkPermission(query).allowed;
}
