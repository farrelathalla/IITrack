import { randomBytes } from "node:crypto";
import { z } from "zod";
import { canGlobally } from "@/lib/auth/access";
import { hashPassword } from "@/lib/auth/password";
import type { Actor } from "@/lib/auth/types";
import { recordActivity, type Tx } from "@/server/activity";
import { viewerOf } from "@/server/auth/actor";
import { hashToken } from "@/server/auth/session";
import { prisma } from "@/server/db";
import { ActionError, parseInput } from "@/server/project/mutate";

/** Link undangan berlaku 7 hari. */
export const INVITATION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

/** Alamat halaman undangan, relatif terhadap origin aplikasi. */
export function invitationPath(token: string): string {
  return `/undangan/${token}`;
}

/**
 * Menerbitkan link undangan baru untuk satu akun di dalam transaksi pemanggil.
 * Link lama yang belum dipakai ikut dibatalkan, jadi hanya link terakhir yang
 * berlaku. Mengembalikan token mentah; yang disimpan hanya HMAC-nya.
 */
export async function createInvitation(
  tx: Tx,
  params: { userId: string; createdById: string; now: Date },
): Promise<string> {
  await tx.invitation.updateMany({
    where: { userId: params.userId, usedAt: null, revokedAt: null },
    data: { revokedAt: params.now },
  });
  const token = randomBytes(32).toString("base64url");
  await tx.invitation.create({
    data: {
      userId: params.userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(params.now.getTime() + INVITATION_LIFETIME_MS),
      createdById: params.createdById,
      createdAt: params.now,
    },
  });
  return token;
}

/**
 * Buat Link Undangan dari Users & Roles: untuk anggota yang belum sempat
 * memakai link sebelumnya, atau yang lupa kata sandi. Hanya Super Admin.
 */
export async function issueInvitation(params: {
  actor: Actor;
  userId: string;
  now?: Date;
}): Promise<string> {
  const now = params.now ?? new Date();
  const decision = canGlobally(viewerOf(params.actor, now), "users.manage");
  if (!decision.allowed) throw new ActionError(decision.reason);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({
      where: { id: params.userId },
      select: { id: true, name: true, status: true, passwordHash: true },
    });
    if (!user) throw new ActionError("Akun tidak ditemukan.");
    if (user.status !== "ACTIVE") {
      throw new ActionError(
        "Akses akun ini sudah dicabut. Aktifkan lagi lewat Edit Role sebelum membuat link undangan.",
      );
    }
    const token = await createInvitation(tx, {
      userId: user.id,
      createdById: params.actor.userId,
      now,
    });
    await recordActivity(tx, {
      actorId: params.actor.userId,
      action: "user.invitation_issued",
      summary: user.passwordHash
        ? `Membuat link atur ulang kata sandi untuk ${user.name}`
        : `Membuat link undangan untuk ${user.name}`,
      division: "SYSTEM",
      objectType: "user",
      objectId: user.id,
    });
    return token;
  });
}

export type InvitationState =
  | { status: "valid"; name: string; email: string; hasPassword: boolean }
  | { status: "invalid"; reason: string };

async function findInvitation(client: Tx | typeof prisma, token: string) {
  return client.invitation.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          passwordHash: true,
        },
      },
    },
  });
}

type FoundInvitation = NonNullable<Awaited<ReturnType<typeof findInvitation>>>;

function problemWith(
  invitation: FoundInvitation | null,
  now: Date,
): string | null {
  if (!invitation) return "Link undangan tidak dikenal. Periksa lagi linknya.";
  if (invitation.usedAt) {
    return "Link ini sudah dipakai. Silakan masuk dengan email dan kata sandimu.";
  }
  if (invitation.revokedAt) {
    return "Link ini sudah diganti dengan link yang lebih baru. Minta link terbaru ke Super Admin.";
  }
  if (invitation.expiresAt <= now) {
    return "Link ini sudah kedaluwarsa. Minta link baru ke Super Admin.";
  }
  if (invitation.user.status !== "ACTIVE") {
    return "Akses akun ini sudah dicabut. Hubungi Super Admin.";
  }
  return null;
}

/** Status link undangan untuk halaman /undangan/[token]. */
export async function readInvitation(
  token: string,
  now: Date = new Date(),
): Promise<InvitationState> {
  const invitation = await findInvitation(prisma, token);
  const problem = problemWith(invitation, now);
  if (problem || !invitation) {
    return { status: "invalid", reason: problem ?? "Link tidak valid." };
  }
  return {
    status: "valid",
    name: invitation.user.name,
    email: invitation.user.email,
    hasPassword: Boolean(invitation.user.passwordHash),
  };
}

const acceptSchema = z
  .object({
    password: z.string().min(8, "Kata sandi minimal 8 karakter."),
    confirm: z.string(),
  })
  .refine((value) => value.password === value.confirm, {
    path: ["confirm"],
    message: "Konfirmasi kata sandi tidak sama.",
  });

/**
 * Anggota membuat kata sandinya sendiri lewat link undangan. Link langsung
 * hangus, dan sesi lama akun itu dicabut (berguna saat dipakai untuk lupa
 * kata sandi). Mengembalikan id akun supaya pemanggil bisa langsung membuat
 * sesi baru.
 */
export async function acceptInvitation(params: {
  token: string;
  password: string;
  confirm: string;
  now?: Date;
}): Promise<string> {
  const now = params.now ?? new Date();
  const input = parseInput(acceptSchema, {
    password: params.password,
    confirm: params.confirm,
  });
  const passwordHash = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const invitation = await findInvitation(tx, params.token);
    const problem = problemWith(invitation, now);
    if (problem || !invitation)
      throw new ActionError(problem ?? "Link tidak valid.");

    // Tandai terpakai lebih dulu dengan syarat, supaya dua kiriman bersamaan
    // tidak sama-sama berhasil.
    const claimed = await tx.invitation.updateMany({
      where: { id: invitation.id, usedAt: null, revokedAt: null },
      data: { usedAt: now },
    });
    if (claimed.count === 0) {
      throw new ActionError(
        "Link ini sudah dipakai. Silakan masuk dengan email dan kata sandimu.",
      );
    }
    await tx.user.update({
      where: { id: invitation.userId },
      data: { passwordHash },
    });
    await tx.session.updateMany({
      where: { userId: invitation.userId, revokedAt: null },
      data: { revokedAt: now },
    });
    await recordActivity(tx, {
      actorId: invitation.userId,
      action: "user.invitation_accepted",
      summary: invitation.user.passwordHash
        ? "Mengatur ulang kata sandi lewat link"
        : "Mengaktifkan akun lewat link undangan",
      division: "SYSTEM",
      objectType: "user",
      objectId: invitation.userId,
    });
    return invitation.userId;
  });
}
