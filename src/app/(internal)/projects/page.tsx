import type { Metadata } from "next";
import {
  type ActiveProjectRow,
  ActiveProjectsTable,
} from "@/components/project/active-projects-table";
import { ProjectsHeader, StatCard } from "@/components/project/projects-header";
import { PROJECT_TONE, URGENCY_TONE } from "@/components/project/tones";
import {
  canGlobally,
  MY_ROLE_LABELS,
  seesAllProjects,
} from "@/lib/auth/access";
import { stageDefinition } from "@/lib/project/catalog";
import { pmOf } from "@/lib/project/snapshot";
import {
  PROJECT_STATUS_LABELS,
  urgencyLabel,
  urgencyOf,
} from "@/lib/project/status";
import { daysUntil } from "@/lib/time";
import { requireUser } from "@/server/auth/current";
import { listProjects } from "@/server/project/queries";

export const metadata: Metadata = { title: "Project Aktif" };

export default async function ActiveProjectsPage() {
  const { viewer } = await requireUser();
  const now = new Date();
  const items = await listProjects(viewer, { closed: false, now });

  const rows: ActiveProjectRow[] = items.map(({ project, summary, myRole }) => {
    const deadline = summary.nearestDeadline;
    const status = summary.status ?? "ON_TRACK";
    return {
      code: project.code,
      name: project.name,
      client: project.client,
      pm: pmOf(project)?.name ?? "-",
      myRole: myRole ? MY_ROLE_LABELS[myRole] : null,
      stageNumber: summary.current.n,
      stageName: stageDefinition(summary.current.n).shortName,
      completed: summary.completed,
      status,
      statusLabel: PROJECT_STATUS_LABELS[status],
      statusTone: PROJECT_TONE[status],
      deadlineLabel: deadline?.label ?? null,
      deadlineChip: deadline ? urgencyLabel(deadline.date, now) : null,
      deadlineTone: deadline
        ? URGENCY_TONE[urgencyOf(deadline.date, now)].tone
        : "neutral",
      nextAction: summary.nextAction?.label ?? "-",
    };
  });

  const mine = seesAllProjects(viewer.role)
    ? items.length
    : items.filter((i) => i.myRole && i.myRole !== "C_LEVEL").length;
  const dueThisWeek = items.filter((i) =>
    i.deadlines.some((d) => {
      const days = daysUntil(d.date, now);
      return days >= 0 && days <= 7;
    }),
  ).length;
  const overdue = items.filter((i) =>
    i.deadlines.some((d) => daysUntil(d.date, now) < 0),
  ).length;

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 p-6">
      <ProjectsHeader
        active="active"
        canCreate={canGlobally(viewer, "project.create").allowed}
      />
      <p className="text-muted text-xs">
        Project aktif yang sedang menjadi tanggung jawabmu.
      </p>
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="Project Aktif Saya"
          value={mine}
          sub="ditugaskan kepadamu"
          accent="text-plum-600"
        />
        <StatCard
          label="Deadline Minggu Ini"
          value={dueThisWeek}
          sub="dalam 7 hari ke depan"
          accent="text-warning-dot"
        />
        <StatCard
          label="Menunggu Aksi Saya"
          value={items.filter((i) => i.awaitingMe).length}
          sub="butuh tindakanmu"
          accent="text-plum-600"
        />
        <StatCard
          label="Overdue"
          value={overdue}
          sub="melewati batas waktu"
          accent="text-danger-text"
        />
      </div>
      <ActiveProjectsTable rows={rows} />
    </div>
  );
}
