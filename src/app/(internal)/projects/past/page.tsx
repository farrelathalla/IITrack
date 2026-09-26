import type { Metadata } from "next";
import {
  type PastProjectRow,
  PastProjectsTable,
} from "@/components/project/past-projects-table";
import { ProjectsHeader, StatCard } from "@/components/project/projects-header";
import { canGlobally, MY_ROLE_LABELS } from "@/lib/auth/access";
import { PROJECT_TYPE_LABELS, type ProjectType } from "@/lib/project/catalog";
import { FINAL_STATUS_LABELS } from "@/lib/project/closure";
import { formatDate, yearInWib } from "@/lib/time";
import { requireUser } from "@/server/auth/current";
import { listPastProjects } from "@/server/project/queries";

export const metadata: Metadata = { title: "Project Selesai" };

export default async function PastProjectsPage() {
  const { viewer } = await requireUser();
  const now = new Date();
  const items = await listPastProjects(viewer, now);

  const rows: PastProjectRow[] = items.map(({ project, myRole }) => {
    const closedAt = project.closedAt ?? now;
    const final = project.finalStatus ?? "ON_TIME";
    return {
      code: project.code,
      name: project.name,
      typeLabel: project.type
        ? PROJECT_TYPE_LABELS[project.type as ProjectType]
        : "Other",
      client: project.client,
      myRole: myRole ? MY_ROLE_LABELS[myRole] : null,
      closedLabel: formatDate(closedAt),
      year: yearInWib(closedAt),
      finalLabel: FINAL_STATUS_LABELS[final],
      finalTone: final === "LATE" ? "warning" : "success",
    };
  });

  const thisYear = rows.filter((r) => r.year === yearInWib(now)).length;
  const onTime = items.filter((i) => i.project.finalStatus !== "LATE").length;
  const rate =
    items.length === 0 ? "-" : `${Math.round((onTime / items.length) * 100)}%`;

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 p-6">
      <ProjectsHeader
        active="past"
        canCreate={canGlobally(viewer, "project.create").allowed}
      />
      <p className="text-muted text-xs">
        Riwayat project yang pernah kamu tangani.
      </p>
      <div className="grid grid-cols-3 gap-3">
        <StatCard
          label="Project selesai"
          value={items.length}
          sub="seluruh riwayat"
          accent="text-success-text"
        />
        <StatCard
          label={`Selesai tahun ${yearInWib(now)}`}
          value={thisYear}
          sub="tahun berjalan"
          accent="text-plum-600"
        />
        <StatCard
          label="Completion rate"
          value={rate}
          sub="selesai tepat waktu atau lebih awal"
          accent="text-ink"
        />
      </div>
      <PastProjectsTable rows={rows} />
    </div>
  );
}
