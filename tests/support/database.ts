import type { Actor, Division, RoleName } from "@/lib/auth/types";
import { prisma } from "@/server/db";

/**
 * Test memakai klien yang sama dengan aplikasi, bukan klien kedua.
 *
 * Dua klien berarti dua connection pool ke basis data yang sama, dan pada
 * transaksi bersamaan keduanya berebut sampai koneksinya terputus.
 */
export const testDb = prisma;

/**
 * Penanda unik per eksekusi test.
 *
 * Data test tidak dibersihkan dengan menghapus jejak aktivitasnya, karena
 * memang tidak bisa: larangan hapus ditegakkan trigger basis data dan tidak ada
 * jalan pintas untuk siapa pun, termasuk test. Sebagai gantinya setiap
 * eksekusi memakai email dan periode yang berbeda, sehingga sisa eksekusi
 * sebelumnya tidak pernah mengganggu.
 */
export const RUN = `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4)}`;

export function uniqueEmail(prefix: string): string {
  return `${prefix}${RUN}@iit.test`;
}

/**
 * Periode empat digit yang berbeda tiap eksekusi.
 *
 * Dipakai test yang menghasilkan riwayat tahap. Riwayat itu tidak bisa dihapus
 * karena larangannya ditegakkan trigger, dan projectnya pun ikut tidak bisa
 * dihapus karena dirujuk riwayat, jadi test memakai ruang nomor sendiri
 * alih-alih membersihkan bekasnya.
 */
export function uniquePeriod(): string {
  return `9${String(Math.floor(Math.random() * 1000)).padStart(3, "0")}`;
}

/** Menghapus project sebuah periode. Project tidak tersentuh larangan append-only. */
export async function cleanUpProjects(period: string): Promise<void> {
  await testDb.project.deleteMany({ where: { period } });
}

/** Mengosongkan penghitung nomor sebuah periode agar test mulai dari nol. */
export async function resetCounter(period: string): Promise<void> {
  await testDb.projectNumberCounter.deleteMany({ where: { period } });
}

/** Membuat pengurus aktif beserta penetapan jabatannya, siap dipakai sebagai actor. */
export async function actorFrom(
  email: string,
  role: RoleName,
  division: Division,
): Promise<{ userId: string; actor: Actor }> {
  const user = await testDb.user.create({
    data: {
      email,
      name: email,
      status: "ACTIVE",
      roleAssignments: {
        create: {
          role,
          division,
          period: "2026/2027",
          startDate: new Date("2020-01-01T00:00:00.000Z"),
          endDate: null,
        },
      },
    },
    include: { roleAssignments: true },
  });

  return {
    userId: user.id,
    actor: {
      userId: user.id,
      status: "ACTIVE",
      roleAssignments: user.roleAssignments.map((a) => ({
        role: a.role as RoleName,
        division: a.division as Division,
        startDate: a.startDate,
        endDate: a.endDate,
        isSystemAdmin: a.isSystemAdmin,
      })),
    },
  };
}
