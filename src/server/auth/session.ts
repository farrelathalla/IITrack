import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { evaluateSession } from "@/lib/auth/session";
import type { Actor, Division, RoleName, UserStatus } from "@/lib/auth/types";
import { prisma } from "@/server/db";

const COOKIE_NAME = "iitrack_session";
const SESSION_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

function sessionSecret(): string {
  const secret = process.env.SESSION_SECRET;

  if (!secret || secret.length < 32) {
    throw new Error(
      "SESSION_SECRET belum diisi atau terlalu pendek. Isi minimal 32 karakter acak di berkas .env.",
    );
  }

  return secret;
}

/**
 * Yang disimpan di basis data adalah HMAC-nya, bukan tokennya. Dengan begitu
 * salinan basis data saja tidak cukup untuk memakai sesi orang lain.
 */
function hashToken(token: string): string {
  return createHmac("sha256", sessionSecret())
    .update(token)
    .digest("base64url");
}

export interface AuthenticatedSession {
  sessionId: string;
  actor: Actor;
}

export async function createSession(
  userId: string,
  userAgent: string | null,
): Promise<void> {
  const token = randomBytes(32).toString("base64url");

  await prisma.session.create({
    data: {
      tokenHash: hashToken(token),
      userId,
      expiresAt: new Date(Date.now() + SESSION_LIFETIME_MS),
      userAgent,
    },
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_LIFETIME_MS / 1000,
  });
}

/**
 * Membaca sesi dari cookie lalu memeriksanya terhadap status akun dan masa
 * jabatan pemiliknya. Pemeriksaan dilakukan pada setiap permintaan, sehingga
 * pencabutan berlaku seketika tanpa menunggu sesinya kedaluwarsa sendiri.
 *
 * Sesi yang sudah tidak sah langsung dicabut di basis data, supaya token yang
 * sama tidak perlu diperiksa ulang pada permintaan berikutnya.
 */
export async function getAuthenticatedSession(): Promise<AuthenticatedSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      user: {
        select: {
          id: true,
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
      },
    },
  });

  if (!session) return null;

  const actor: Actor = {
    userId: session.user.id,
    status: session.user.status as UserStatus,
    roleAssignments: session.user.roleAssignments.map((assignment) => ({
      role: assignment.role as RoleName,
      division: assignment.division as Division,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      isSystemAdmin: assignment.isSystemAdmin,
    })),
  };

  const evaluation = evaluateSession({
    session: { expiresAt: session.expiresAt, revokedAt: session.revokedAt },
    user: { status: actor.status, roleAssignments: actor.roleAssignments },
    now: new Date(),
  });

  if (!evaluation.valid) {
    if (session.revokedAt === null) {
      await prisma.session.update({
        where: { id: session.id },
        data: { revokedAt: new Date() },
      });
    }
    return null;
  }

  return { sessionId: session.id, actor };
}

export async function revokeCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    await prisma.session.updateMany({
      where: { tokenHash: hashToken(token), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  store.delete(COOKIE_NAME);
}

/** Dipakai ketika akun dinonaktifkan atau masa jabatannya ditutup. */
export async function revokeAllSessionsFor(userId: string): Promise<void> {
  await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export { COOKIE_NAME };
