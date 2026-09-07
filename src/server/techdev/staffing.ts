import { z } from "zod";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { checkPermission } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import type { WorkingHoursConfig } from "@/lib/sla/working-hours";
import {
  DEFAULT_WORKING_HOURS,
  workingMinutesBetween,
} from "@/lib/sla/working-hours";
import {
  decideSubmission,
  submitForApproval,
} from "@/server/approval/workflow";
import { recordAudit } from "@/server/audit";
import { prisma } from "@/server/db";
import { assignMember } from "@/server/project/members";
import { addReference } from "@/server/project/references";

export type Refusal = {
  ok: false;
  reason: string;
  fields?: Record<string, string>;
};

function refuse(reason: string, fields?: Record<string, string>): Refusal {
  return { ok: false, reason, fields };
}

const requestSchema = z.object({
  roleNeeded: z.string().trim().min(1, "Jabatan yang dibutuhkan wajib diisi."),
  headcount: z
    .number()
    .int("Jumlah orang harus bilangan bulat.")
    .min(1, "Jumlah orang minimal satu."),
  neededBy: z.date(),
  technicalNeeds: z.string().trim().min(1, "Kebutuhan teknis wajib diisi."),
  deliverable: z.string().trim().min(1, "Deliverable wajib diisi."),
});

export type RequestStaffingFields = z.input<typeof requestSchema>;

export interface RequestStaffingInput extends RequestStaffingFields {
  actor: Actor;
  projectDbId: string;
  now?: Date;
}

/**
 * Mengajukan kebutuhan programmer kepada CTO.
 *
 * Permintaannya disimpan sebagai data tersendiri karena memuat kebutuhan teknis
 * dan deliverable, sedangkan persetujuannya berjalan lewat rantai F17 supaya
 * tidak ada alur persetujuan kedua yang terpisah.
 */
export async function requestStaffing(
  input: RequestStaffingInput,
): Promise<{ ok: true; requestId: string; submissionId: string } | Refusal> {
  const now = input.now ?? new Date();

  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fields[key]) fields[key] = issue.message;
    }
    return refuse(
      "Permintaan belum bisa diajukan karena ada isian yang belum lengkap.",
      fields,
    );
  }

  // submitForApproval sudah memeriksa izin staffing.request terhadap penugasan
  // project, jadi pemeriksaannya tidak diulang di sini.
  const submission = await submitForApproval({
    actor: input.actor,
    type: "STAFFING_REQUEST",
    projectDbId: input.projectDbId,
    payload: {
      roleNeeded: parsed.data.roleNeeded,
      headcount: parsed.data.headcount,
      neededBy: parsed.data.neededBy.toISOString(),
    },
    now,
  });
  if (!submission.ok) return refuse(submission.reason);

  const request = await prisma.staffingRequest.create({
    data: {
      projectId: input.projectDbId,
      requestedById: input.actor.userId,
      roleNeeded: parsed.data.roleNeeded,
      headcount: parsed.data.headcount,
      neededBy: parsed.data.neededBy,
      technicalNeeds: parsed.data.technicalNeeds,
      deliverable: parsed.data.deliverable,
      submissionId: submission.submissionId,
      requestedAt: now,
    },
    select: { id: true },
  });

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.STAFFING_REQUESTED,
    objectType: AUDIT_OBJECTS.STAFFING_REQUEST,
    objectId: request.id,
    after: {
      projectId: input.projectDbId,
      jabatan: parsed.data.roleNeeded,
      jumlah: parsed.data.headcount,
    },
  });

  return {
    ok: true,
    requestId: request.id,
    submissionId: submission.submissionId,
  };
}

export interface FulfillStaffingInput {
  actor: Actor;
  requestId: string;
  /** Anggota TechDev yang ditetapkan. Boleh lebih sedikit dari yang diminta. */
  memberUserIds: string[];
  /**
   * Repository project, ditautkan pada langkah yang sama (F14-AC4).
   *
   * Opsional karena tidak setiap penetapan membuat repository baru. Yang sudah
   * pernah ditautkan tidak dianggap kegagalan.
   */
  repositoryUrl?: string | null;
  workingHours?: WorkingHoursConfig;
  now?: Date;
}

export interface StaffingResponseTime {
  workingMinutes: number;
  requestedAt: Date;
  fulfilledAt: Date;
}

/**
 * CTO menetapkan anggota untuk sebuah permintaan.
 *
 * Satu langkah menyelesaikan empat hal sekaligus: menyetujui pengajuan pada
 * rantai F17, menugaskan anggota sebagai pelaksana TechDev project, menautkan
 * repository projectnya bila disebutkan, dan menstempel waktu penetapan untuk
 * perhitungan lama tanggapan.
 *
 * Repository ditautkan di sini, bukan sebagai langkah terpisah sesudahnya,
 * karena PRD F14 memintanya pada langkah yang sama. Penautannya tetap lewat
 * addReference milik F25, jadi pemeriksaan bentuk alamat dan kewenangannya
 * tidak ditulis dua kali.
 */
export async function fulfillStaffingRequest(
  input: FulfillStaffingInput,
): Promise<{ ok: true; responseTime: StaffingResponseTime } | Refusal> {
  const now = input.now ?? new Date();

  if (input.memberUserIds.length === 0) {
    return refuse("Tetapkan sekurangnya satu anggota sebelum menyimpan.");
  }

  const request = await prisma.staffingRequest.findUnique({
    where: { id: input.requestId },
    select: {
      id: true,
      projectId: true,
      status: true,
      submissionId: true,
      requestedAt: true,
    },
  });
  if (!request) return refuse("Permintaan yang dimaksud tidak ditemukan.");

  if (request.status !== "SUBMITTED") {
    return refuse("Permintaan ini sudah selesai diproses sebelumnya.");
  }

  // Menyetujui pengajuannya sekaligus menegakkan kewenangan: rantai
  // STAFFING_REQUEST hanya bisa diputuskan CTO atau Vice CTO.
  if (request.submissionId) {
    const keputusan = await decideSubmission({
      actor: input.actor,
      submissionId: request.submissionId,
      decision: "APPROVED",
      now,
    });
    if (!keputusan.ok) return refuse(keputusan.reason);
  }

  for (const userId of input.memberUserIds) {
    const hasil = await assignMember({
      actor: input.actor,
      projectDbId: request.projectId,
      userId,
      division: "TECHDEV",
      now,
    });

    // Anggota yang sudah ditugaskan sebelumnya tidak dianggap kegagalan; yang
    // ditolak karena wewenang atau divisi tetap dilaporkan.
    if (!hasil.ok && !hasil.reason.includes("sudah ditugaskan")) {
      return refuse(hasil.reason);
    }
  }

  if (input.repositoryUrl) {
    const tautan = await addReference({
      actor: input.actor,
      projectDbId: request.projectId,
      url: input.repositoryUrl,
      label: "Repository project",
      now,
    });

    // Repository yang sudah pernah ditautkan bukan kegagalan penetapan.
    if (!tautan.ok && !tautan.reason.includes("sudah")) {
      return refuse(tautan.reason);
    }
  }

  await prisma.staffingRequest.update({
    where: { id: request.id },
    data: {
      status: "FULFILLED",
      fulfilledAt: now,
      fulfilledById: input.actor.userId,
    },
  });

  const workingMinutes = workingMinutesBetween(
    request.requestedAt,
    now,
    input.workingHours ?? DEFAULT_WORKING_HOURS,
  );

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.STAFFING_FULFILLED,
    objectType: AUDIT_OBJECTS.STAFFING_REQUEST,
    objectId: request.id,
    before: { status: "SUBMITTED" },
    after: {
      status: "FULFILLED",
      anggota: input.memberUserIds,
      lamaTanggapanMenitKerja: workingMinutes,
    },
  });

  return {
    ok: true,
    responseTime: {
      workingMinutes,
      requestedAt: request.requestedAt,
      fulfilledAt: now,
    },
  };
}

/**
 * Antrean permintaan yang menunggu CTO, terlama lebih dulu.
 *
 * Lama menunggu dihitung dalam jam kerja, bukan jam kalender, supaya akhir
 * pekan tidak membuat sebuah permintaan tampak jauh lebih lama tertahan.
 */
export async function readStaffingQueue(
  now: Date = new Date(),
  workingHours: WorkingHoursConfig = DEFAULT_WORKING_HOURS,
) {
  const rows = await prisma.staffingRequest.findMany({
    where: { status: "SUBMITTED" },
    orderBy: { requestedAt: "asc" },
    select: {
      id: true,
      roleNeeded: true,
      headcount: true,
      neededBy: true,
      technicalNeeds: true,
      deliverable: true,
      requestedAt: true,
      project: {
        select: {
          id: true,
          projectId: true,
          name: true,
          clientName: true,
        },
      },
      requestedBy: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    projectDbId: row.project.id,
    projectId: row.project.projectId,
    projectName: row.project.name,
    clientName: row.project.clientName,
    requestedBy: row.requestedBy.name,
    roleNeeded: row.roleNeeded,
    headcount: row.headcount,
    neededBy: row.neededBy,
    technicalNeeds: row.technicalNeeds,
    deliverable: row.deliverable,
    requestedAt: row.requestedAt,
    waitingWorkingMinutes: workingMinutesBetween(
      row.requestedAt,
      now,
      workingHours,
    ),
  }));
}

/** Izin melihat antrean, dipakai pemanggil sebelum menampilkannya. */
export function canReadStaffingQueue(actor: Actor, now: Date): boolean {
  return checkPermission({ actor, action: "techdev.view", now }).allowed;
}

export type TechDevMemberOption = {
  id: string;
  name: string;
  email: string;
};

/**
 * Anggota aktif jabatan TechDev Member, untuk kotak pilihan penetapan CTO.
 *
 * CTO dan wakilnya tidak ikut karena yang ditetapkan adalah pelaksana
 * programmer. Ditolak tanpa `staffing.approve` supaya daftar nama tidak bocor
 * lewat permintaan langsung. Konteks project palsu hanya melewati syarat aksi
 * bercakupan project; CTO memegang izin ini secara global.
 */
export async function listAssignableTechDevMembers(
  actor: Actor,
  now: Date = new Date(),
): Promise<{ ok: true; members: TechDevMemberOption[] } | Refusal> {
  const izin = checkPermission({
    actor,
    action: "staffing.approve",
    project: { projectId: "*", assignedDivisions: [] },
    now,
  });
  if (!izin.allowed) return refuse(izin.reason);

  const rows = await prisma.user.findMany({
    where: {
      status: "ACTIVE",
      roleAssignments: {
        some: {
          role: "TECHDEV_MEMBER",
          division: "TECHDEV",
          startDate: { lte: now },
          OR: [{ endDate: null }, { endDate: { gt: now } }],
        },
      },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true, email: true },
  });

  return { ok: true, members: rows };
}
