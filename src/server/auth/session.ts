import { createHmac, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import {
  alasanFromSessionEnd,
  type LoginAlasan,
} from "@/lib/auth/login-notice";
import { evaluateSession } from "@/lib/auth/session";
import type { Actor } from "@/lib/auth/types";
import { ACTOR_SELECT, toActor } from "@/server/auth/actor";
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

type CookieStore = Awaited<ReturnType<typeof cookies>>;

/**
 * Menghapus cookie sesi, dan diam bila konteksnya memang tidak boleh menulis.
 *
 * `inspectSession` dipanggil dari Server Action maupun dari render Server
 * Component. Yang pertama boleh mengubah cookie, yang kedua tidak: Next
 * melempar "Cookies can only be modified in a Server Action or Route Handler".
 * Melempar di sana berarti setiap halaman membalas 500, termasuk halaman masuk,
 * sehingga pengguna yang sesinya baru dicabut tidak punya jalan kembali selain
 * menghapus cookie perambannya sendiri.
 */
function forgetSessionCookie(store: CookieStore): void {
  try {
    store.delete(COOKIE_NAME);
  } catch {
    // Konteks render. Sesinya sudah dicabut di basis data, jadi cookie yang
    // tertinggal hanya akan dinilai ulang dan ditolak lagi.
  }
}

export interface AuthenticatedSession {
  sessionId: string;
  actor: Actor;
}

/**
 * Hasil pemeriksaan sesi untuk penjaga halaman. Membedakan "belum pernah
 * masuk" dari "sesi yang baru saja berakhir", supaya halaman masuk tidak
 * menampilkan pesan berakhir palsu (F02-T03).
 */
export type SessionInspection =
  | { kind: "authenticated"; session: AuthenticatedSession }
  | { kind: "anonymous" }
  | { kind: "ended"; alasan: Exclude<LoginAlasan, "logout"> };

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
export async function inspectSession(): Promise<SessionInspection> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return { kind: "anonymous" };

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      id: true,
      expiresAt: true,
      revokedAt: true,
      user: { select: ACTOR_SELECT },
    },
  });

  if (!session) return { kind: "anonymous" };

  const actor: Actor = toActor(session.user);

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

    // Cookie dihapus bila konteksnya memang boleh menulis cookie. Pemeriksaan
    // ini dipanggil juga dari render Server Component, dan di sana Next
    // melarang perubahan cookie: percobaannya melempar, halaman berubah
    // menjadi galat 500, dan pengguna yang masa jabatannya habis justru
    // terkunci dari halaman masuk. Pencabutan yang sesungguhnya sudah terjadi
    // di basis data beberapa baris di atas, jadi cookie yang tertinggal tidak
    // memberi akses apa pun; ia hanya akan dinilai ulang dan ditolak lagi.
    forgetSessionCookie(store);

    return {
      kind: "ended",
      alasan: alasanFromSessionEnd(evaluation.code),
    };
  }

  return {
    kind: "authenticated",
    session: { sessionId: session.id, actor },
  };
}

export async function getAuthenticatedSession(): Promise<AuthenticatedSession | null> {
  const inspection = await inspectSession();
  return inspection.kind === "authenticated" ? inspection.session : null;
}

export async function revokeCurrentSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;

  if (token) {
    const tokenHash = hashToken(token);
    await prisma.session.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  store.delete(COOKIE_NAME);
}

/**
 * Mencabut seluruh sesi seseorang sekaligus.
 *
 * Dipanggil ketika akses dicabut, supaya pemiliknya langsung keluar tanpa
 * menunggu permintaan berikutnya. Pemeriksaan per permintaan pada
 * `inspectSession` tetap menjadi jaring pengaman bila pemanggilan ini terlewat.
 */
export async function revokeAllSessionsFor(userId: string): Promise<number> {
  const revoked = await prisma.session.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return revoked.count;
}

export { COOKIE_NAME };
