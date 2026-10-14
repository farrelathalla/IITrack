"use client";

import { AlertTriangle, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import {
  ProjectIdChip,
  ProjectStatusChip,
} from "@/components/project/status-chip";
import { PROJECT_TOP_BAR } from "@/components/project/tones";
import { Badge } from "@/components/ui/badge";
import { PROJECT_ROLE_LABELS } from "@/lib/auth/roles";
import { financialSummary } from "@/lib/finance/terms";
import { formatRupiah } from "@/lib/money";
import {
  isStageNumber,
  stageDefinition,
  TOTAL_STAGES,
} from "@/lib/project/catalog";
import { FINAL_STATUS_LABELS } from "@/lib/project/closure";
import { pmOf } from "@/lib/project/snapshot";
import { defaultPanelStage } from "@/lib/project/stages";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { ActivityItem } from "@/server/project/queries";
import type { ProjectView } from "@/server/project/view";
import { ActivityDrawer } from "./activity-drawer";
import { AssignmentModal, type AssignmentMode } from "./assignment-modal";
import { ProjectProvider, useProject } from "./context";
import { DivisionTabs } from "./division-tabs";
import { ProjectDetailsMenu } from "./project-details-menu";
import { StagePanel } from "./stage-panel";
import { WorkflowStepper } from "./stepper";

function Header({
  onHistory,
  onAssign,
}: {
  onHistory: () => void;
  onAssign: (mode: AssignmentMode) => void;
}) {
  const { project, summary, amountsHidden } = useProject();
  const money = financialSummary(project.terms);
  const pm = pmOf(project);
  const percent = Math.round((summary.completed / TOTAL_STAGES) * 100);
  const color =
    percent >= 70 ? "#1a7048" : percent >= 40 ? "#5b3f9a" : "#d39a3a";
  const deadline = summary.nearestDeadline;

  const info = [
    ["Client", project.client],
    ["Project Manager", pm?.name ?? "-"],
    [
      "Stage Saat Ini",
      project.closedAt ? "Selesai" : stageDefinition(summary.current.n).name,
    ],
    ["Tanggal Mulai", formatDate(project.targetStart)],
    ["Target Selesai", formatDate(project.targetEnd)],
    [
      "Deadline Terdekat",
      deadline ? `${formatDate(deadline.date)}: ${deadline.label}` : "-",
    ],
  ];

  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
      <div
        className={cn(
          "h-1.5",
          summary.status ? PROJECT_TOP_BAR[summary.status] : "bg-success-text",
        )}
      />
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              <ProjectIdChip code={project.code} />
              {summary.status ? (
                <ProjectStatusChip status={summary.status} />
              ) : null}
              {project.closedAt && project.finalStatus ? (
                <Badge
                  tone={project.finalStatus === "LATE" ? "warning" : "success"}
                  dot
                >
                  {FINAL_STATUS_LABELS[project.finalStatus]}
                </Badge>
              ) : null}
            </div>
            <h1 className="font-bold text-xl text-ink">{project.name}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <ProjectDetailsMenu onHistory={onHistory} onAssign={onAssign} />
            <Link
              href={project.closedAt ? "/projects/past" : "/projects"}
              className="rounded-lg px-3 py-1.5 font-semibold text-muted text-xs hover:bg-surface hover:text-ink"
            >
              Kembali
            </Link>
          </div>
        </div>
        {!amountsHidden && project.terms.length > 0 ? (
          <dl className="mt-4 grid grid-cols-2 gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm sm:grid-cols-4">
            {(
              [
                ["Nilai kontrak", money.total],
                ["Sudah ditagih", money.billed],
                ["Sudah dibayar", money.paid],
                ["Sisa", money.remaining],
              ] as const
            ).map(([label, amount]) => (
              <div key={label}>
                <dt className="text-muted text-xs">{label}</dt>
                <dd className="font-semibold text-ink">
                  {formatRupiah(amount)}
                </dd>
              </div>
            ))}
          </dl>
        ) : null}

        {summary.needsReassignment.length > 0 ? (
          <div className="mt-4 flex items-center gap-2 rounded-lg border border-danger-line bg-danger-bg px-3 py-2 text-danger-text text-xs">
            <AlertTriangle className="size-4 shrink-0" />
            <span>
              <strong>Perlu Penugasan Ulang:</strong>{" "}
              {summary.needsReassignment
                .map((a) => `${PROJECT_ROLE_LABELS[a.role]} ${a.name}`)
                .join(", ")}{" "}
              sudah tidak aktif.
            </span>
          </div>
        ) : null}

        <div className="mt-5 grid grid-cols-6 gap-4">
          {info.map(([label, value]) => (
            <div key={label}>
              <p className="mb-0.5 font-semibold text-[10px] text-subtle uppercase tracking-wider">
                {label}
              </p>
              <p className="font-medium text-ink text-xs">{value}</p>
            </div>
          ))}
        </div>

        <div className="mt-5 border-surface border-t pt-4">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="font-semibold text-muted text-xs">
              Project Health
            </span>
            <span className="font-bold text-sm" style={{ color }}>
              {percent}%
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full transition-[width] duration-300 ease-(--ease-out)"
              style={{ width: `${percent}%`, backgroundColor: color }}
            />
          </div>
          <p className="mt-1 text-[11px] text-subtle">
            {summary.completed} dari 9 stage selesai
          </p>
        </div>
      </div>
    </div>
  );
}

function Detail({ activity }: { activity: ActivityItem[] }) {
  const view = useProject();
  const router = useRouter();
  const params = useSearchParams();
  const [assignment, setAssignment] = useState<AssignmentMode | null>(null);
  const [history, setHistory] = useState(false);

  const requested = Number(params.get("stage"));
  const stage = isStageNumber(requested)
    ? requested
    : defaultPanelStage(view.stages);

  const select = useCallback(
    (n: number) => {
      const search = new URLSearchParams(params.toString());
      search.set("stage", String(n));
      router.replace(`?${search.toString()}`, { scroll: false });
    },
    [params, router],
  );
  const closeHistory = useCallback(() => setHistory(false), []);

  return (
    <div className="mx-auto max-w-[1280px] space-y-5 p-6">
      <nav className="flex items-center gap-1.5 text-muted text-xs">
        <Link href="/projects" className="hover:text-plum-600">
          Semua Project
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-ink">{view.project.name}</span>
      </nav>
      <Header onHistory={() => setHistory(true)} onAssign={setAssignment} />
      <WorkflowStepper selected={stage} onSelect={select} />
      <StagePanel stage={stage} onAssign={setAssignment} />
      <details className="rounded-xl border border-line bg-white p-4 shadow-sm">
        <summary className="cursor-pointer font-semibold text-ink text-sm">
          Ringkasan per divisi (bukan alur kerja)
        </summary>
        <div className="mt-4">
          <DivisionTabs onAssign={setAssignment} />
        </div>
      </details>
      <AssignmentModal mode={assignment} onClose={() => setAssignment(null)} />
      <ActivityDrawer open={history} onClose={closeHistory} items={activity} />
    </div>
  );
}

export function ProjectDetail({
  view,
  activity,
}: {
  view: ProjectView;
  activity: ActivityItem[];
}) {
  return (
    <ProjectProvider view={view}>
      <Detail activity={activity} />
    </ProjectProvider>
  );
}
