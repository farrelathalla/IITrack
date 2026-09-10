import { buildPmAssignmentSlaView } from "@/lib/sla/display";
import { prisma } from "@/server/db";

/**
 * Membaca project yang sudah punya stempel SLA supaya UI bisa menampilkannya
 * tanpa mengulang query di setiap halaman.
 */
export async function listProjectsWithPmSla() {
  const projects = await prisma.project.findMany({
    where: {
      OR: [
        { clientConfirmedAt: { not: null } },
        { pmAssignedAt: { not: null } },
      ],
    },
    orderBy: { pmAssignedAt: "desc" },
    select: {
      id: true,
      projectId: true,
      name: true,
      clientConfirmedAt: true,
      pmAssignedAt: true,
      assignedPm: { select: { name: true } },
    },
    take: 20,
  });

  return projects.map((project) => ({
    ...project,
    sla: buildPmAssignmentSlaView({
      clientConfirmedAt: project.clientConfirmedAt,
      pmAssignedAt: project.pmAssignedAt,
    }),
  }));
}
