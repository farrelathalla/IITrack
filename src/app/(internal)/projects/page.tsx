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
  const onSchedule = items.filter(
    (item) => item.summary.status === "ON_TRACK",
  ).length;

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 p-6">
      <ProjectsHeader
        title="Active Projects"
        subtitle="Projects currently assigned to you."
        canCreate={canGlobally(viewer, "project.create").allowed}
      />
      <div className="grid grid-cols-4 gap-3">
        <StatCard
          label="My Active Projects"
          value={mine}
          sub="ditugaskan kepadamu"
          accent="text-ink"
        />
        <StatCard
          label="On Schedule"
          value={onSchedule}
          sub={
            items.length === 0
              ? "tidak ada project aktif"
              : `${Math.round((onSchedule / items.length) * 100)}% dari total`
          }
        />
        <StatCard
          label="Needs Attention"
          value={
            items.filter(
              (item) =>
                item.summary.status === "AT_RISK" ||
                item.summary.status === "ACTION_REQUIRED",
            ).length
          }
          sub="at risk atau action required"
          accent="text-warning-text"
        />
        <StatCard
          label="Pending Approval"
          value={
            items.filter((item) => item.summary.status === "WAITING_APPROVAL")
              .length
          }
          sub="menunggu persetujuan"
          accent="text-plum-600"
        />
      </div>
      <ActiveProjectsTable rows={rows} />
    </div>
  );
}
