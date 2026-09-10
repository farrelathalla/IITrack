import type { Actor, Division, RoleName, UserStatus } from "@/lib/auth/types";
import { prisma } from "@/server/db";

/**
 * Membaca pengguna beserta seluruh penetapan jabatannya, lalu membentuknya
 * menjadi `Actor` yang dipahami penentu izin.
 *
 * Penyaringan masa berlaku sengaja tidak dilakukan di sini. Penentu izin yang
 * memutuskan jabatan mana yang masih berlaku, supaya aturannya hanya ada di
 * satu tempat dan bisa diuji tanpa basis data.
 */
export async function loadActor(userId: string): Promise<Actor | null> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
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
  });

  if (!user) return null;

  return {
    userId: user.id,
    status: user.status as UserStatus,
    roleAssignments: user.roleAssignments.map((assignment) => ({
      role: assignment.role as RoleName,
      division: assignment.division as Division,
      startDate: assignment.startDate,
      endDate: assignment.endDate,
      isSystemAdmin: assignment.isSystemAdmin,
    })),
  };
}
