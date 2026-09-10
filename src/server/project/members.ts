import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { activeAssignments } from "@/lib/auth/period";
import { checkPermission } from "@/lib/auth/permissions";
import type { Actor, Division, RoleName } from "@/lib/auth/types";
import { canAssignToDivision } from "@/lib/project/assignment-rules";
import { recordAudit } from "@/server/audit";
import { prisma } from "@/server/db";

/**
 * Penanda mesin untuk penolakan yang pemanggilnya perlu bedakan.
 *
 * `reason` ditulis untuk dibaca pengguna dan wajar diperhalus sewaktu-waktu,
 * jadi pemanggil tidak boleh mengenali sebuah penolakan dari potongan
 * kalimatnya. Penanda ini yang dipakai, dan mengubah kalimatnya tidak lagi
 * mengubah perilaku pemanggil.
 */
export type MemberRefusalCode = "ALREADY_ASSIGNED";

export type Refusal = { ok: false; reason: string; code?: MemberRefusalCode };

function refuse(reason: string, code?: MemberRefusalCode): Refusal {
  return code ? { ok: false, reason, code } : { ok: false, reason };
}

export interface AssignMemberInput {
  actor: Actor;
  projectDbId: string;
  userId: string;
  division: Division;
  now?: Date;
}

/**
 * Menugaskan seseorang sebagai pelaksana sebuah project pada satu divisi.
 *
 * Dua batas diperiksa di sini: pengaju harus berwenang menugaskan sama sekali,
 * dan divisi yang ditujunya harus domainnya sendiri. Yang kedua tidak bisa
 * diwakilkan ke penentu izin umum, karena izin `project.assign_member` sama
 * untuk seluruh C-Level sedangkan domainnya berbeda-beda.
 */
export async function assignMember(
  input: AssignMemberInput,
): Promise<{ ok: true; assignmentId: string } | Refusal> {
  const now = input.now ?? new Date();

  const izin = checkPermission({
    actor: input.actor,
    action: "project.assign_member",
    project: { projectId: input.projectDbId, assignedDivisions: [] },
    now,
  });
  if (!izin.allowed) return refuse(izin.reason);

  if (!canAssignToDivision(input.actor, input.division, now)) {
    return refuse(
      `Anda hanya bisa menugaskan pelaksana di divisi yang Anda pimpin, dan ${input.division} bukan salah satunya.`,
    );
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectDbId },
    select: { id: true },
  });
  if (!project) return refuse("Project yang dimaksud tidak ditemukan.");

  const target = await prisma.user.findUnique({
    where: { id: input.userId },
    select: {
      id: true,
      name: true,
      status: true,
      roleAssignments: {
        select: {
          role: true,
          division: true,
          startDate: true,
          endDate: true,
          isSystemAdmin: true,
        },
      },
    },
  });
  if (target?.status !== "ACTIVE") {
    return refuse(
      "Pengurus yang dipilih tidak aktif, jadi belum bisa ditugaskan.",
    );
  }

  // Menugaskan orang yang jabatannya berada di divisi lain akan memberinya hak
  // edit pada domain yang bukan wewenangnya.
  const bertugasDiDivisi = activeAssignments(
    target.roleAssignments.map((a) => ({
      role: a.role as RoleName,
      division: a.division as Division,
      startDate: a.startDate,
      endDate: a.endDate,
      isSystemAdmin: a.isSystemAdmin,
    })),
    now,
  ).some((a) => a.division === input.division);

  if (!bertugasDiDivisi) {
    return refuse(
      `${target.name} tidak sedang menjabat di divisi ${input.division}, jadi belum bisa ditugaskan sebagai pelaksananya.`,
    );
  }

  const sudahAda = await prisma.projectAssignment.findFirst({
    where: {
      projectId: project.id,
      userId: target.id,
      division: input.division,
      endedAt: null,
    },
    select: { id: true },
  });
  if (sudahAda) {
    return refuse(
      `${target.name} sudah ditugaskan pada divisi ini di project tersebut.`,
      "ALREADY_ASSIGNED",
    );
  }

  const created = await prisma.projectAssignment.create({
    data: {
      projectId: project.id,
      userId: target.id,
      division: input.division,
      assignedById: input.actor.userId,
    },
    select: { id: true },
  });

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.PROJECT_MEMBER_ASSIGNED,
    objectType: AUDIT_OBJECTS.PROJECT,
    objectId: project.id,
    after: { pelaksana: target.id, divisi: input.division },
  });

  return { ok: true, assignmentId: created.id };
}

export interface EndAssignmentInput {
  actor: Actor;
  assignmentId: string;
  now?: Date;
}

/**
 * Mengakhiri sebuah penugasan.
 *
 * Barisnya tidak dihapus, hanya ditandai berakhir, sehingga riwayat penugasan
 * lama tetap terbaca (F31-AC3).
 */
export async function endAssignment(
  input: EndAssignmentInput,
): Promise<{ ok: true } | Refusal> {
  const now = input.now ?? new Date();

  const existing = await prisma.projectAssignment.findUnique({
    where: { id: input.assignmentId },
    select: {
      id: true,
      projectId: true,
      userId: true,
      division: true,
      endedAt: true,
    },
  });
  if (!existing) return refuse("Penugasan yang dimaksud tidak ditemukan.");

  if (existing.endedAt !== null) {
    return refuse("Penugasan ini sudah berakhir sebelumnya.");
  }

  const izin = checkPermission({
    actor: input.actor,
    action: "project.assign_member",
    project: { projectId: existing.projectId, assignedDivisions: [] },
    now,
  });
  if (!izin.allowed) return refuse(izin.reason);

  if (!canAssignToDivision(input.actor, existing.division as Division, now)) {
    return refuse(
      `Anda hanya bisa mencabut penugasan di divisi yang Anda pimpin, dan ${existing.division} bukan salah satunya.`,
    );
  }

  await prisma.projectAssignment.update({
    where: { id: existing.id },
    data: { endedAt: now },
  });

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.PROJECT_MEMBER_UNASSIGNED,
    objectType: AUDIT_OBJECTS.PROJECT,
    objectId: existing.projectId,
    before: { pelaksana: existing.userId, divisi: existing.division },
    after: { pelaksana: null, divisi: existing.division },
  });

  return { ok: true };
}
