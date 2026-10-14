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
import { listDirectoryProjects } from "@/server/project/queries";

export const metadata: Metadata = { title: "All Projects" };

export default async function AllProjectsPage() {
  const { viewer } = await requireUser();
  const items = await listDirectoryProjects(viewer, new Date());

  const rows: AllProjectRow[] = items.map(({ project, summary }) => ({
    code: project.code,
    name: project.name,
    client: project.client,
    pm: pmOf(project)?.name ?? "-",
    statusLabel: project.closedAt ? "Completed" : "Active",
    statusTone: project.closedAt ? "success" : "brand",
    stageName: project.closedAt
      ? "Closed"
      : stageDefinition(summary.current.n).shortName,
    updatedLabel: formatDate(project.updatedAt),
  }));

  return (
    <div className="w-full space-y-5 px-8 py-8">
      <ProjectsHeader
        title="All Projects"
        subtitle="View all projects across Inkubator IT."
        canCreate={canGlobally(viewer, "project.create").allowed}
      />
      <AllProjectsTable rows={rows} />
    </div>
  );
}
