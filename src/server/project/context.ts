import { activeAssignments } from "@/lib/auth/period";
import type { Actor, Division, ProjectContext } from "@/lib/auth/types";
import { prisma } from "@/server/db";

/**
 * Menyusun konteks penugasan seseorang pada sebuah project.
 *
 * Dua sumber digabung. Penugasan PM (F04) memberi domain Operational kepada PM
 * yang ditunjuk COO. Penugasan pelaksana (F31) memberi domain sesuai divisinya,
 * dan satu project bisa punya pelaksana dari tiga divisi sekaligus.
 *
 * Penugasan saja tidak cukup: pemegangnya harus masih menjabat di divisi itu
 * pada saat diperiksa. Tanpa syarat kedua, nama yang masih tercantum sebagai
 * pelaksana tetap memberi hak edit setelah masa jabatannya habis.
 */
export async function projectContextFor(
  actor: Actor,
  projectDbId: string,
  now: Date = new Date(),
): Promise<ProjectContext> {
  const project = await prisma.project.findUnique({
    where: { id: projectDbId },
    select: {
      id: true,
      assignedPmId: true,
      assignments: {
        where: { userId: actor.userId, endedAt: null },
        select: { division: true },
      },
    },
  });

  if (!project) {
    return { projectId: projectDbId, assignedDivisions: [] };
  }

  const stillServingIn = new Set(
    activeAssignments(actor.roleAssignments, now).map(
      (assignment) => assignment.division,
    ),
  );

  const divisions = new Set<Division>();

  if (
    project.assignedPmId === actor.userId &&
    stillServingIn.has("OPERATIONAL")
  ) {
    divisions.add("OPERATIONAL");
  }

  for (const assignment of project.assignments) {
    const division = assignment.division as Division;
    if (stillServingIn.has(division)) divisions.add(division);
  }

  return { projectId: project.id, assignedDivisions: [...divisions] };
}
