import type { Actor } from "@/lib/auth/types";
import { canReadMemberList } from "@/lib/member/access";
import { prisma } from "@/server/db";

/**
 * Daftar pengurus beserta penetapan jabatannya untuk halaman F07.
 *
 * Izin diperiksa di sini, bukan hanya disembunyikan di tampilan, supaya
 * permintaan langsung ke server tetap ditolak (F03-AC2). Sebelumnya fungsi ini
 * tidak menerima actor sama sekali, sehingga setiap pengguna yang sudah masuk
 * bisa membaca seluruh daftarnya.
 */
export async function listMembersWithRoles(
  actor: Actor,
  now: Date = new Date(),
) {
  if (!canReadMemberList(actor, now)) return null;

  return prisma.user.findMany({
    orderBy: [{ status: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      email: true,
      status: true,
      roleAssignments: {
        orderBy: { startDate: "desc" },
        select: {
          id: true,
          role: true,
          division: true,
          period: true,
          startDate: true,
          endDate: true,
          isSystemAdmin: true,
        },
      },
    },
  });
}
