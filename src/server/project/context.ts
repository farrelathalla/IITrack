import { activeAssignments } from "@/lib/auth/period";
import type { Actor, Division, ProjectContext } from "@/lib/auth/types";
import { prisma } from "@/server/db";

/**
 * Menyusun konteks penugasan seseorang pada sebuah project.
 *
 * Untuk saat ini penugasan hanya berupa PM yang ditunjuk COO (F04), sehingga
 * domain yang diberikan baru Operational. Penugasan pelaksana Finance dan
 * TechDev menyusul pada F31; ketika itu tiba, hanya fungsi ini yang berubah
 * dan pemakainya tidak perlu disentuh.
 */
export async function projectContextFor(
  actor: Actor,
  projectDbId: string,
  now: Date = new Date(),
): Promise<ProjectContext> {
  const project = await prisma.project.findUnique({
    where: { id: projectDbId },
    select: { id: true, assignedPmId: true },
  });

  if (!project) {
    return { projectId: projectDbId, assignedDivisions: [] };
  }

  const divisions: Division[] = [];

  if (project.assignedPmId === actor.userId) {
    // Penugasan hanya berlaku selama jabatannya masih berlaku. Pengurus yang
    // masa jabatannya habis tidak boleh tetap memegang hak edit hanya karena
    // namanya masih tercantum sebagai PM.
    const stillServing = activeAssignments(actor.roleAssignments, now).some(
      (assignment) => assignment.division === "OPERATIONAL",
    );

    if (stillServing) divisions.push("OPERATIONAL");
  }

  return { projectId: project.id, assignedDivisions: divisions };
}
