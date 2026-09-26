import type { Actor, RoleName } from "@/lib/auth/types";
import { ACTOR_SELECT, toActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";

/**
 * Test memakai klien yang sama dengan aplikasi, bukan klien kedua, supaya
 * transaksi bersamaan tidak berebut dua connection pool.
 */
export const testDb = prisma;

/**
 * Penanda unik per eksekusi test. Riwayat aktivitas tidak bisa dihapus
 * (trigger basis data), jadi data test tidak dibersihkan; setiap eksekusi
 * memakai email dan periode yang berbeda.
 */
export const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

let counter = 0;

export function uniqueEmail(prefix: string): string {
  counter += 1;
  return `${prefix}.${RUN}.${counter}@iit.test`;
}

/**
 * Periode uji yang sedang berjalan, dengan kode empat digit unik (9xxx)
 * supaya Project ID tiap eksekusi tidak bertabrakan.
 */
export async function testPeriod(): Promise<{ id: string; code: string }> {
  const code = `9${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
  const now = Date.now();
  return testDb.period.create({
    data: {
      name: `${code}/${RUN}`,
      code,
      startDate: new Date(now - 30 * 24 * 3600 * 1000),
      endDate: new Date(now + 365 * 24 * 3600 * 1000),
    },
    select: { id: true, code: true },
  });
}

/** Membuat pengurus aktif dengan satu jabatan pada periode uji. */
export async function createActor(
  role: RoleName,
  periodId: string,
  name: string = role,
): Promise<Actor> {
  const user = await testDb.user.create({
    data: {
      email: uniqueEmail(role.toLowerCase()),
      name,
      roleAssignments: { create: { role, periodId } },
    },
    select: ACTOR_SELECT,
  });
  return toActor(user);
}
