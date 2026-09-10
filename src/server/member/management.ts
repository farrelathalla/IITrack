import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { checkPermission } from "@/lib/auth/permissions";
import type { Actor, Division, RoleName } from "@/lib/auth/types";
import {
  handoverBoundary,
  overlaps,
  validatePeriod,
} from "@/lib/member/role-period";
import { recordAudit } from "@/server/audit";
import { revokeAllSessionsFor } from "@/server/auth/session";
import { prisma } from "@/server/db";

export type Refusal = { ok: false; reason: string };

function refuse(reason: string): Refusal {
  return { ok: false, reason };
}

export interface AssignRoleInput {
  actor: Actor;
  userId: string;
  role: RoleName;
  division: Division;
  period: string;
  startDate: Date;
  endDate: Date | null;
  isSystemAdmin?: boolean;
  now?: Date;
}

/**
 * Menetapkan jabatan seseorang untuk satu periode.
 *
 * Penetapan yang beririsan dengan penetapan lain pada jabatan yang sama
 * ditolak, karena dua periode aktif sekaligus membuat pertanyaan sejak kapan
 * seseorang berwenang tidak punya satu jawaban.
 */
export async function assignRole(
  input: AssignRoleInput,
): Promise<{ ok: true; roleAssignmentId: string } | Refusal> {
  const now = input.now ?? new Date();

  const izin = checkPermission({
    actor: input.actor,
    action: "user.manage_role_assignment",
    now,
  });
  if (!izin.allowed) return refuse(izin.reason);

  const periode = validatePeriod({
    startDate: input.startDate,
    endDate: input.endDate,
  });
  if (!periode.valid) return refuse(periode.reason);

  const target = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, name: true },
  });
  if (!target) return refuse("Pengurus yang dimaksud tidak ditemukan.");

  const existing = await prisma.roleAssignment.findMany({
    where: { userId: input.userId, role: input.role },
    select: { startDate: true, endDate: true },
  });

  const bertabrakan = existing.some((current) =>
    overlaps(
      { startDate: current.startDate, endDate: current.endDate },
      { startDate: input.startDate, endDate: input.endDate },
    ),
  );

  if (bertabrakan) {
    return refuse(
      `${target.name} sudah punya masa jabatan yang beririsan dengan rentang ini. Tutup dulu masa jabatan lamanya, atau pakai alur serah terima.`,
    );
  }

  const created = await prisma.roleAssignment.create({
    data: {
      userId: input.userId,
      role: input.role,
      division: input.division,
      period: input.period,
      startDate: input.startDate,
      endDate: input.endDate,
      isSystemAdmin: input.isSystemAdmin ?? false,
    },
    select: { id: true },
  });

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.MEMBER_ROLE_ASSIGNED,
    objectType: AUDIT_OBJECTS.USER,
    objectId: input.userId,
    after: {
      role: input.role,
      divisi: input.division,
      periode: input.period,
      mulai: input.startDate.toISOString(),
      selesai: input.endDate?.toISOString() ?? null,
      systemAdmin: input.isSystemAdmin ?? false,
    },
  });

  return { ok: true, roleAssignmentId: created.id };
}

export interface OverrideRolePeriodInput {
  actor: Actor;
  roleAssignmentId: string;
  newEndDate: Date | null;
  reason: string;
  now?: Date;
}

/**
 * Mengubah masa berlaku sebuah jabatan untuk kondisi khusus.
 *
 * Alasan wajib diisi, dan perubahannya tercatat beserta nilai lama, nilai baru,
 * pelaku, dan waktunya (F07-AC2).
 */
export async function overrideRolePeriod(
  input: OverrideRolePeriodInput,
): Promise<{ ok: true } | Refusal> {
  const now = input.now ?? new Date();

  const izin = checkPermission({
    actor: input.actor,
    action: "user.override_period",
    now,
  });
  if (!izin.allowed) return refuse(izin.reason);

  if (input.reason.trim().length === 0) {
    return refuse(
      "Perubahan masa jabatan wajib menyertakan alasannya, supaya keputusannya bisa ditelusuri kembali.",
    );
  }

  const existing = await prisma.roleAssignment.findUnique({
    where: { id: input.roleAssignmentId },
    select: {
      id: true,
      userId: true,
      role: true,
      startDate: true,
      endDate: true,
    },
  });
  if (!existing)
    return refuse("Penetapan jabatan yang dimaksud tidak ditemukan.");

  const periode = validatePeriod({
    startDate: existing.startDate,
    endDate: input.newEndDate,
  });
  if (!periode.valid) return refuse(periode.reason);

  await prisma.roleAssignment.update({
    where: { id: existing.id },
    data: { endDate: input.newEndDate },
  });

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.MEMBER_ROLE_PERIOD_OVERRIDDEN,
    objectType: AUDIT_OBJECTS.USER,
    objectId: existing.userId,
    before: {
      role: existing.role,
      selesai: existing.endDate?.toISOString() ?? null,
    },
    after: {
      role: existing.role,
      selesai: input.newEndDate?.toISOString() ?? null,
    },
    reason: input.reason,
  });

  return { ok: true };
}

export interface HandoverRoleInput {
  actor: Actor;
  fromRoleAssignmentId: string;
  toUserId: string;
  effectiveAt: Date;
  newPeriod: string;
  newEndDate?: Date | null;
  reason: string;
  now?: Date;
}

/**
 * Serah terima jabatan: menutup masa jabatan lama dan membuka masa jabatan baru
 * dalam satu langkah.
 *
 * Keduanya ditulis dalam satu transaksi. Kalau dipisah, ada kemungkinan jabatan
 * lama tertutup tanpa penggantinya terbuka, dan sejak saat itu tidak ada
 * seorang pun yang berwenang di posisi tersebut.
 */
export async function handoverRole(
  input: HandoverRoleInput,
): Promise<{ ok: true; newRoleAssignmentId: string } | Refusal> {
  const now = input.now ?? new Date();

  const izin = checkPermission({
    actor: input.actor,
    action: "user.manage_role_assignment",
    now,
  });
  if (!izin.allowed) return refuse(izin.reason);

  if (input.reason.trim().length === 0) {
    return refuse("Serah terima jabatan wajib menyertakan alasannya.");
  }

  const lama = await prisma.roleAssignment.findUnique({
    where: { id: input.fromRoleAssignmentId },
    select: {
      id: true,
      userId: true,
      role: true,
      division: true,
      startDate: true,
      endDate: true,
      isSystemAdmin: true,
    },
  });
  if (!lama) {
    return refuse("Penetapan jabatan yang diserahterimakan tidak ditemukan.");
  }

  if (input.effectiveAt.getTime() <= lama.startDate.getTime()) {
    return refuse(
      "Tanggal serah terima harus setelah tanggal mulai masa jabatan yang diserahkan.",
    );
  }

  const penerima = await prisma.user.findUnique({
    where: { id: input.toUserId },
    select: { id: true, status: true },
  });
  if (penerima?.status !== "ACTIVE") {
    return refuse(
      "Penerima serah terima tidak aktif, jadi jabatannya belum bisa dibuka.",
    );
  }

  const batas = handoverBoundary(input.effectiveAt);

  const [, dibuat] = await prisma.$transaction([
    prisma.roleAssignment.update({
      where: { id: lama.id },
      data: { endDate: batas.closesAt },
    }),
    prisma.roleAssignment.create({
      data: {
        userId: input.toUserId,
        role: lama.role,
        division: lama.division,
        period: input.newPeriod,
        startDate: batas.opensAt,
        endDate: input.newEndDate ?? null,
        isSystemAdmin: lama.isSystemAdmin,
      },
      select: { id: true },
    }),
  ]);

  // Pengurus lama kehilangan kewenangan sejak saat ini, jadi sesinya dicabut
  // tanpa menunggu permintaan berikutnya.
  await revokeAllSessionsFor(lama.userId, {
    actorId: input.actor.userId,
    reason: `Serah terima jabatan: ${input.reason}`,
  });

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.MEMBER_HANDOVER,
    objectType: AUDIT_OBJECTS.USER,
    objectId: lama.userId,
    before: {
      role: lama.role,
      pemegang: lama.userId,
      selesai: lama.endDate?.toISOString() ?? null,
    },
    after: {
      role: lama.role,
      pemegang: input.toUserId,
      berlakuSejak: batas.opensAt.toISOString(),
    },
    reason: input.reason,
  });

  return { ok: true, newRoleAssignmentId: dibuat.id };
}

export interface DeactivateUserInput {
  actor: Actor;
  userId: string;
  reason: string;
  now?: Date;
}

/** Menonaktifkan akun dan mencabut seluruh sesinya seketika. */
export async function deactivateUser(
  input: DeactivateUserInput,
): Promise<{ ok: true; revokedSessions: number } | Refusal> {
  const now = input.now ?? new Date();

  const izin = checkPermission({
    actor: input.actor,
    action: "user.deactivate",
    now,
  });
  if (!izin.allowed) return refuse(izin.reason);

  if (input.reason.trim().length === 0) {
    return refuse("Penonaktifan akun wajib menyertakan alasannya.");
  }

  const target = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, status: true },
  });
  if (!target) return refuse("Pengurus yang dimaksud tidak ditemukan.");

  await prisma.user.update({
    where: { id: target.id },
    data: { status: "DEACTIVATED" },
  });

  const revokedSessions = await revokeAllSessionsFor(target.id, {
    actorId: input.actor.userId,
    reason: input.reason,
  });

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.USER_DEACTIVATED,
    objectType: AUDIT_OBJECTS.USER,
    objectId: target.id,
    before: { status: target.status },
    after: { status: "DEACTIVATED" },
    reason: input.reason,
  });

  return { ok: true, revokedSessions };
}
