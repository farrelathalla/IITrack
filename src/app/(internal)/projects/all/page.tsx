import type { Metadata } from "next";
import {
  type AllProjectRow,
  AllProjectsTable,
} from "@/components/project/all-projects-table";
import { ProjectsHeader } from "@/components/project/projects-header";
import { canGlobally } from "@/lib/auth/access";
import { stageDefinition } from "@/lib/project/catalog";
import { pmOf } from "@/lib/project/snapshot";
import { formatDate } from "@/lib/time";
import { requireUser } from "@/server/auth/current";
import { listPastProjects, listProjects } from "@/server/project/queries";

export const metadata: Metadata = { title: "All Projects" };

export default async function AllProjectsPage() {
  const { viewer } = await requireUser();
  const now = new Date();
  const [active, past] = await Promise.all([
    listProjects(viewer, { closed: false, now }),
    listPastProjects(viewer, now),
  ]);

  const rows: AllProjectRow[] = [
    ...active.map(({ project, summary }) => ({
      code: project.code,
      name: project.name,
      client: project.client,
      pm: pmOf(project)?.name ?? "-",
      statusLabel: "Active",
      statusTone: "brand" as const,
      stageName: stageDefinition(summary.current.n).shortName,
      updatedLabel: formatDate(project.updatedAt),
    })),
    ...past.map(({ project }) => ({
      code: project.code,
      name: project.name,
      client: project.client,
      pm: pmOf(project)?.name ?? "-",
      statusLabel: "Completed",
      statusTone: "success" as const,
      stageName: "Closed",
      updatedLabel: formatDate(project.updatedAt),
    })),
  ];

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 p-6">
      <ProjectsHeader
        title="All Projects"
        subtitle="View all projects across Inkubator IT."
        canCreate={canGlobally(viewer, "project.create").allowed}
      />
      <AllProjectsTable rows={rows} />
    </div>
  );
}
