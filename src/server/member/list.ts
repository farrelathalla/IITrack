import { prisma } from "@/server/db";

/** Daftar pengurus beserta penetapan jabatannya untuk halaman F07. */
export async function listMembersWithRoles() {
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
