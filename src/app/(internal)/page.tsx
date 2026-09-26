import type { Metadata } from "next";
import Link from "next/link";
import { ProjectCard } from "@/components/project/project-card";
import { URGENCY_TONE } from "@/components/project/tones";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/card";
import { seesAllProjects } from "@/lib/auth/access";
import {
  isFinanceLead,
  isOpsLead,
  isTechLead,
  PROJECT_ROLE_LABELS,
} from "@/lib/auth/roles";
import type { ProjectRole } from "@/lib/auth/types";
import { urgencyLabel, urgencyOf } from "@/lib/project/status";
import {
  formatDateTimeShort,
  formatDayMonthUpper,
  formatToday,
  yearInWib,
} from "@/lib/time";
import { cn } from "@/lib/utils";
import { requireUser } from "@/server/auth/current";
import {
  listPastProjects,
  listProjects,
  projectCounts,
  recentActivity,
} from "@/server/project/queries";

export const metadata: Metadata = { title: "Dashboard" };

const RESULT_ICON: Record<string, { cls: string; icon: string }> = {
  APPROVED: {
    cls: "border-success-line bg-success-bg text-success-text",
    icon: "✓",
  },
  REJECTED: {
    cls: "border-danger-line bg-danger-bg text-danger-text",
    icon: "✗",
  },
  UPDATED: { cls: "border-plum-200 bg-plum-50 text-plum-500", icon: "·" },
  SUBMITTED: { cls: "border-plum-200 bg-plum-50 text-plum-600", icon: "↑" },
  CREATED: { cls: "border-plum-200 bg-plum-50 text-plum-600", icon: "+" },
};

export default async function DashboardPage() {
  const { actor, viewer } = await requireUser();
  const now = new Date();
  const yearStart = new Date(`${yearInWib(now)}-01-01T00:00:00+07:00`);

  const [items, past, counts] = await Promise.all([
    listProjects(viewer, { closed: false, now }),
    listPastProjects(viewer, now),
    projectCounts(yearStart),
  ]);
  const activity = await recentActivity(
    seesAllProjects(viewer.role)
      ? "all"
      : [...items, ...past].map((i) => i.project.id),
  );

  const deadlines = items
    .flatMap((item) =>
      item.deadlines.map((deadline) => ({
        ...deadline,
        project: item.project,
      })),
    )
    .sort((a, b) => a.date.getTime() - b.date.getTime())
    .slice(0, 6);
  const overdue = deadlines.filter(
    (d) => urgencyOf(d.date, now) === "overdue",
  ).length;

  // Perlu Penugasan Ulang: khusus C-Level, sesuai divisinya (PRD bab 8.1).
  const leadOf: ProjectRole[] = [
    ...(isOpsLead(viewer.role) ? (["PM"] as const) : []),
    ...(isTechLead(viewer.role) ? (["DEVELOPER"] as const) : []),
    ...(isFinanceLead(viewer.role) ? (["FINANCE_POC"] as const) : []),
  ];
  const reassign = items.flatMap((item) =>
    item.summary.needsReassignment
      .filter((a) => leadOf.includes(a.role))
      .map((a) => ({ item, assignment: a })),
  );

  const completedThisYear = seesAllProjects(viewer.role)
    ? counts.completedThisYear
    : past.filter((p) => p.project.closedAt && p.project.closedAt >= yearStart)
        .length;

  const stats = [
    {
      label: "Semua Project",
      value: counts.all,
      sub: "di seluruh organisasi",
      icon: "📁",
      accent: "text-ink",
    },
    {
      label: "Project Aktif",
      value: items.length,
      sub: "sedang berjalan",
      icon: "▶",
      accent: "text-plum-600",
    },
    {
      label: "Menunggu Persetujuan",
      value: items.filter((i) =>
        i.stages.some((s) => s.status === "waiting-approval"),
      ).length,
      sub: "butuh tindakan",
      icon: "⏳",
      accent: "text-warning-dot",
    },
    {
      label: "Project Selesai",
      value: completedThisYear,
      sub: `tahun ${yearInWib(now)}`,
      icon: "✓",
      accent: "text-success-text",
    },
  ];

  return (
    <div className="mx-auto max-w-[1200px] space-y-5 p-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="font-bold text-ink text-xl">Dashboard</h1>
          <p className="mt-0.5 text-muted text-sm">
            Selamat datang,{" "}
            <strong className="font-semibold text-ink">{actor.name}</strong>.
          </p>
        </div>
        <div className="pt-1 text-subtle text-xs">{formatToday(now)}</div>
      </div>

      {reassign.length > 0 ? (
        <section className="rounded-xl border border-danger-line bg-danger-bg p-4">
          <h2 className="mb-2 font-bold text-danger-text text-sm">
            Perlu Penugasan Ulang
          </h2>
          <ul className="space-y-1.5">
            {reassign.map(({ item, assignment }) => (
              <li
                key={`${item.project.id}-${assignment.userId}`}
                className="flex items-center justify-between gap-3 rounded-lg bg-white px-3 py-2 text-xs"
              >
                <span>
                  <strong className="text-ink">{item.project.name}</strong>{" "}
                  <span className="text-muted">
                    — {PROJECT_ROLE_LABELS[assignment.role]} {assignment.name}{" "}
                    sudah tidak aktif
                  </span>
                </span>
                <Link
                  href={`/projects/${item.project.code}?tab=${assignment.role === "PM" ? "pm" : assignment.role === "DEVELOPER" ? "tech" : "finance"}`}
                  className="rounded-lg bg-plum-600 px-3 py-1 font-semibold text-white hover:bg-plum-700"
                >
                  Ganti
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h2 className="font-bold text-ink text-sm">
              Project Sedang Berjalan
            </h2>
            <span className="inline-flex size-5 items-center justify-center rounded-full bg-plum-600 font-bold text-[10px] text-white">
              {items.length}
            </span>
          </div>
          <Link
            href="/projects"
            className="font-medium text-plum-600 text-xs hover:underline"
          >
            Lihat semua →
          </Link>
        </div>
        <div className="grid gap-3">
          {items.length === 0 ? (
            <EmptyState>
              Belum ada project aktif yang ditugaskan kepadamu.
            </EmptyState>
          ) : (
            items
              .slice(0, 5)
              .map((item) => <ProjectCard key={item.project.id} item={item} />)
          )}
        </div>
      </section>

      <section className="grid grid-cols-4 gap-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="rounded-xl border border-line bg-white px-5 py-4 shadow-sm"
          >
            <div className="mb-2 flex items-start justify-between">
              <p className="font-medium text-muted text-xs">{stat.label}</p>
              <span aria-hidden="true" className="text-base leading-none">
                {stat.icon}
              </span>
            </div>
            <p className={cn("font-bold text-3xl", stat.accent)}>
              {stat.value}
            </p>
            <p className="mt-0.5 text-[11px] text-subtle">{stat.sub}</p>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-[1fr_360px] gap-4">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-ink text-sm">Deadline Terdekat</h2>
              {overdue > 0 ? (
                <Badge tone="danger">{overdue} overdue</Badge>
              ) : null}
            </div>
            <span className="text-[10px] text-subtle">
              Diurutkan berdasarkan urgensi
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
            {deadlines.length === 0 ? (
              <div className="p-8 text-center text-sm text-subtle">
                Tidak ada deadline dalam waktu dekat.
              </div>
            ) : (
              deadlines.map((deadline) => {
                const urgency = URGENCY_TONE[urgencyOf(deadline.date, now)];
                return (
                  <Link
                    key={`${deadline.project.id}-${deadline.label}-${deadline.date.getTime()}`}
                    href={`/projects/${deadline.project.code}?stage=${deadline.stage}`}
                    className="flex items-center gap-4 border-surface border-b px-5 py-3.5 transition-colors last:border-0 hover:bg-surface"
                  >
                    <div
                      className={cn(
                        "w-1 self-stretch shrink-0 rounded-full",
                        urgency.bar,
                      )}
                    />
                    <div className="w-16 shrink-0 text-center">
                      <p className="font-bold text-ink text-xs leading-tight">
                        {formatDayMonthUpper(deadline.date)}
                      </p>
                      <Badge tone={urgency.tone} className="mt-0.5 text-[10px]">
                        {urgencyLabel(deadline.date, now)}
                      </Badge>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink text-sm">
                        {deadline.label}
                      </p>
                      <p className="truncate text-muted text-xs">
                        {deadline.project.name}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1.5">
                      <Avatar name={deadline.responsible.name} />
                      <span className="text-muted text-xs">
                        {deadline.responsible.name.split(" ")[0]}
                      </span>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-bold text-ink text-sm">Aktivitas Terbaru</h2>
            <span className="text-[10px] text-subtle">
              {seesAllProjects(viewer.role) ? "Semua project" : "Project kamu"}
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
            {activity.length === 0 ? (
              <div className="p-8 text-center text-sm text-subtle">
                Belum ada aktivitas tercatat.
              </div>
            ) : (
              activity.map((row) => {
                const icon = RESULT_ICON[row.result] ?? RESULT_ICON.UPDATED;
                return (
                  <div
                    key={row.id}
                    className="flex gap-3 border-surface border-b px-4 py-3.5 last:border-0"
                  >
                    <div
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border font-bold text-[10px]",
                        icon.cls,
                      )}
                    >
                      {icon.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-ink text-xs leading-relaxed">
                        <span className="font-semibold">{row.actorName}</span>{" "}
                        <span className="text-muted">{row.summary}</span>
                      </p>
                      <p className="mt-0.5 truncate text-[10px] text-subtle">
                        {row.projectName} · {formatDateTimeShort(row.createdAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
