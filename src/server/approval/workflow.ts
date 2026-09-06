import type { Prisma } from "@/generated/prisma/client";
import type { SubmissionType } from "@/lib/approval/chain";
import { buildApprovalChain, isEligibleApprover } from "@/lib/approval/chain";
import type { StepDecision } from "@/lib/approval/progress";
import { decideStep } from "@/lib/approval/progress";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { checkPermission } from "@/lib/auth/permissions";
import type { Action, Actor } from "@/lib/auth/types";
import { recordAudit } from "@/server/audit";
import { prisma } from "@/server/db";
import { projectContextFor } from "@/server/project/context";

export type Refusal = { ok: false; reason: string };

/**
 * Menormalkan isi pengajuan menjadi JSON polos.
 *
 * Prisma menolak objek yang bentuknya tidak bisa dipastikan aman disimpan
 * sebagai JSON, jadi nilainya dilewatkan sekali melalui serialisasi.
 */
function toJson(value: unknown): Prisma.InputJsonValue | undefined {
  if (value === undefined || value === null) return undefined;
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function refuse(reason: string): Refusal {
  return { ok: false, reason };
}

/**
 * Izin yang dibutuhkan untuk mengajukan tiap jenis.
 *
 * Yang menentukan siapa boleh menyetujui adalah rantai persetujuan, sedangkan
 * yang menentukan siapa boleh mengajukan adalah izin di bawah ini. Keduanya
 * sengaja dipisah karena pengaju dan penyetuju memang bukan orang yang sama.
 */
const SUBMIT_PERMISSION: Record<SubmissionType, Action> = {
  INVOICE: "finance.submit",
  STAFFING_REQUEST: "staffing.request",
  PROJECT_VALUE_CHANGE: "project.edit_operational",
};

export interface SubmitInput {
  actor: Actor;
  type: SubmissionType;
  projectDbId: string;
  payload?: Record<string, unknown>;
  now?: Date;
}

/**
 * Membuat pengajuan beserta seluruh langkah persetujuannya sekaligus.
 *
 * Langkah dibuat di muka dari rantai, bukan satu per satu saat dibutuhkan,
 * supaya pengaju maupun penyetuju bisa melihat seluruh jalur yang akan dilewati
 * sejak awal. Jabatan yang berwenang ikut disalin ke barisnya agar riwayat
 * tetap terbaca walaupun rantainya berubah di kemudian hari.
 */
export async function submitForApproval(
  input: SubmitInput,
): Promise<
  { ok: true; submissionId: string; currentStepOrder: number } | Refusal
> {
  const now = input.now ?? new Date();

  const project = await prisma.project.findUnique({
    where: { id: input.projectDbId },
    select: { id: true },
  });
  if (!project) return refuse("Project yang dimaksud tidak ditemukan.");

  const konteks = await projectContextFor(input.actor, project.id, now);

  const izin = checkPermission({
    actor: input.actor,
    action: SUBMIT_PERMISSION[input.type],
    project: konteks,
    now,
  });
  if (!izin.allowed) return refuse(izin.reason);

  const chain = buildApprovalChain(input.type);

  const submission = await prisma.submission.create({
    data: {
      type: input.type,
      projectId: project.id,
      submittedById: input.actor.userId,
      status: "PENDING",
      currentStepOrder: chain[0].order,
      payload: toJson(input.payload),
      steps: {
        create: chain.map((step) => ({
          order: step.order,
          label: step.label,
          eligibleRoles: [...step.eligibleRoles],
        })),
      },
    },
    select: { id: true, currentStepOrder: true },
  });

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.SUBMISSION_CREATED,
    objectType: AUDIT_OBJECTS.SUBMISSION,
    objectId: submission.id,
    after: {
      jenis: input.type,
      projectId: project.id,
      langkah: chain.map((step) => step.label),
    },
  });

  return {
    ok: true,
    submissionId: submission.id,
    currentStepOrder: submission.currentStepOrder ?? chain[0].order,
  };
}

export interface DecideInput {
  actor: Actor;
  submissionId: string;
  decision: StepDecision;
  reason?: string | null;
  now?: Date;
}

/**
 * Mencatat keputusan pada langkah yang sedang berjalan, lalu meneruskan atau
 * menghentikan pengajuan.
 *
 * Kewenangan diperiksa di sini, bukan hanya disembunyikan di tampilan, sehingga
 * permintaan langsung ke server tetap ditolak (F17-AC4).
 */
export async function decideSubmission(input: DecideInput): Promise<
  | {
      ok: true;
      status: "PENDING" | "APPROVED" | "REJECTED";
      nextStepOrder: number | null;
    }
  | Refusal
> {
  const now = input.now ?? new Date();

  const submission = await prisma.submission.findUnique({
    where: { id: input.submissionId },
    select: {
      id: true,
      type: true,
      status: true,
      revision: true,
      currentStepOrder: true,
    },
  });
  if (!submission) return refuse("Pengajuan yang dimaksud tidak ditemukan.");

  if (submission.status !== "PENDING" || submission.currentStepOrder === null) {
    return refuse(
      "Pengajuan ini sudah selesai diproses, jadi tidak ada langkah yang menunggu keputusan.",
    );
  }

  const chain = buildApprovalChain(submission.type as SubmissionType);
  const spec = chain.find((step) => step.order === submission.currentStepOrder);
  if (!spec) {
    return refuse(
      "Langkah yang sedang berjalan tidak ada pada rantai pengajuan ini, jadi keputusannya tidak bisa dicatat.",
    );
  }

  if (!isEligibleApprover(input.actor, spec, now)) {
    return refuse(
      `Langkah ini menunggu keputusan ${spec.label}, dan jabatan Anda tidak termasuk di dalamnya.`,
    );
  }

  const penilaian = decideStep({
    chain,
    currentOrder: submission.currentStepOrder,
    decision: input.decision,
    reason: input.reason,
  });
  if (!penilaian.valid) return refuse(penilaian.reason);

  const step = await prisma.approvalStep.findUnique({
    where: {
      submissionId_revision_order: {
        submissionId: submission.id,
        revision: submission.revision,
        order: submission.currentStepOrder,
      },
    },
    select: { id: true, decision: true },
  });
  if (!step) return refuse("Langkah persetujuan tidak ditemukan.");

  if (step.decision !== "PENDING") {
    return refuse(
      "Langkah ini sudah pernah diputuskan, jadi tidak bisa diputuskan lagi.",
    );
  }

  const hasil = penilaian.result;
  const status =
    hasil.outcome === "advanced"
      ? "PENDING"
      : hasil.outcome === "approved"
        ? "APPROVED"
        : "REJECTED";
  const nextStepOrder =
    hasil.outcome === "advanced" ? hasil.nextStepOrder : null;

  await prisma.$transaction([
    prisma.approvalStep.update({
      where: { id: step.id },
      data: {
        decision: input.decision,
        decidedById: input.actor.userId,
        reason: input.reason?.trim() || null,
        decidedAt: now,
      },
    }),
    prisma.submission.update({
      where: { id: submission.id },
      data: { status, currentStepOrder: nextStepOrder },
    }),
  ]);

  await recordAudit({
    actorId: input.actor.userId,
    action:
      input.decision === "APPROVED"
        ? AUDIT_ACTIONS.SUBMISSION_STEP_APPROVED
        : AUDIT_ACTIONS.SUBMISSION_STEP_REJECTED,
    objectType: AUDIT_OBJECTS.SUBMISSION,
    objectId: submission.id,
    before: { status: submission.status, langkah: submission.currentStepOrder },
    after: { status, langkah: nextStepOrder },
    reason: input.reason?.trim() || null,
  });

  return { ok: true, status, nextStepOrder };
}

export interface ReviseInput {
  actor: Actor;
  submissionId: string;
  payload?: Record<string, unknown>;
}

/**
 * Memperbaiki pengajuan yang ditolak.
 *
 * Langkah revisi sebelumnya tidak disentuh sama sekali. Revisi baru menambah
 * satu set langkah dengan nomor revisi berikutnya, sehingga alasan penolakan
 * lama dan siapa yang menolaknya tetap bisa dibaca (F17-AC3).
 */
export async function reviseSubmission(
  input: ReviseInput,
): Promise<{ ok: true; revision: number } | Refusal> {
  const submission = await prisma.submission.findUnique({
    where: { id: input.submissionId },
    select: {
      id: true,
      type: true,
      status: true,
      revision: true,
      submittedById: true,
      payload: true,
    },
  });
  if (!submission) return refuse("Pengajuan yang dimaksud tidak ditemukan.");

  if (submission.status !== "REJECTED") {
    return refuse(
      "Hanya pengajuan yang ditolak yang bisa diperbaiki. Pengajuan ini belum ditolak.",
    );
  }

  if (submission.submittedById !== input.actor.userId) {
    return refuse(
      "Perbaikan hanya bisa dilakukan oleh pengaju yang bersangkutan.",
    );
  }

  const chain = buildApprovalChain(submission.type as SubmissionType);
  const revision = submission.revision + 1;

  await prisma.$transaction([
    prisma.submission.update({
      where: { id: submission.id },
      data: {
        status: "PENDING",
        revision,
        currentStepOrder: chain[0].order,
        payload: toJson(input.payload ?? submission.payload),
      },
    }),
    prisma.approvalStep.createMany({
      data: chain.map((step) => ({
        submissionId: submission.id,
        order: step.order,
        label: step.label,
        eligibleRoles: [...step.eligibleRoles],
        revision,
      })),
    }),
  ]);

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.SUBMISSION_REVISED,
    objectType: AUDIT_OBJECTS.SUBMISSION,
    objectId: submission.id,
    before: { revisi: submission.revision, status: "REJECTED" },
    after: { revisi: revision, status: "PENDING" },
  });

  return { ok: true, revision };
}
