"use client";

import {
  AlertTriangle,
  ChevronRight,
  Code2,
  FolderKanban,
  History,
  ListChecks,
  Wallet,
} from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import {
  ProjectIdChip,
  ProjectStatusChip,
} from "@/components/project/status-chip";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { DivisionTab } from "@/lib/auth/access";
import { PROJECT_ROLE_LABELS } from "@/lib/auth/roles";
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
import { DivisionView } from "./division-tabs";
import { ProjectActionsMenu } from "./project-actions";
import { StagePanel } from "./stage-panel";
import { WorkflowStepper } from "./stepper";

type ViewKey = "workflow" | DivisionTab;

const VIEWS: { key: ViewKey; label: string; icon: typeof Wallet }[] = [
  { key: "workflow", label: "Workflow", icon: ListChecks },
  { key: "pm", label: "Project Manager", icon: FolderKanban },
  { key: "tech", label: "Tech Development", icon: Code2 },
  { key: "finance", label: "Finance", icon: Wallet },
];

/**
 * Tautan lama memakai `?stage=N&tab=pm`. Bila ada `stage`, yang dibuka panel
 * stage itu; `tab` tanpa `stage` membuka tampilan divisinya.
 */
function viewFromParams(params: URLSearchParams): ViewKey {
  const view = params.get("view");
  if (view === "workflow" || view === "pm" || view === "tech") return view;
  if (view === "finance") return view;
  if (params.get("stage")) return "workflow";
  const tab = params.get("tab");
  return tab === "pm" || tab === "tech" || tab === "finance" ? tab : "workflow";
}

function Header({
  onHistory,
  onAssign,
}: {
  onHistory: () => void;
  onAssign: (mode: AssignmentMode) => void;
}) {
  const { project, summary } = useProject();
  const pm = pmOf(project);
  const percent = Math.round((summary.completed / TOTAL_STAGES) * 100);
  const deadline = summary.nearestDeadline;

  const facts = [
    ["Client", project.client],
    ["PM", pm?.name ?? "-"],
    [
      "Target",
      `${formatDate(project.targetStart)} – ${formatDate(project.targetEnd)}`,
    ],
    [
      "Deadline terdekat",
      deadline ? `${formatDate(deadline.date)} · ${deadline.label}` : "-",
    ],
  ];

  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
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
          <h1 className="truncate font-bold text-ink text-xl">
            {project.name}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Button variant="secondary" onClick={onHistory}>
            <History className="size-3.5" />
            Riwayat
          </Button>
          <ProjectActionsMenu onAssign={onAssign} />
        </div>
      </div>

      <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-xs">
        {facts.map(([label, value]) => (
          <div key={label} className="flex gap-1.5">
            <dt className="text-subtle">{label}</dt>
            <dd className="font-medium text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
          <div
            className="h-full rounded-full bg-plum-600 transition-[width] duration-300 ease-(--ease-out)"
            style={{ width: `${percent}%` }}
          />
        </div>
        <span className="shrink-0 text-muted text-xs">
          {project.closedAt
            ? "Project selesai"
            : `Stage ${summary.current.n}/9 · ${stageDefinition(summary.current.n).shortName}`}
        </span>
      </div>

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
    </div>
  );
}

/** Langkah berikutnya untuk project ini, di atas stepper. */
function NextStep({ onSelect }: { onSelect: (n: number) => void }) {
  const { summary, viewer } = useProject();
  const next = summary.nextAction;
  if (!next) return null;
  const mine =
    next.responsible.userId === viewer.userId ||
    (next.responsible.userId === null &&
      viewer.role !== null &&
      next.responsible.roles.includes(viewer.role));
  return (
    <button
      type="button"
      onClick={() => onSelect(next.stage)}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
        mine
          ? "border-plum-200 bg-plum-50 hover:bg-plum-100"
          : "border-line bg-white hover:bg-surface",
      )}
    >
      <span
        className={cn(
          "rounded-md px-2 py-0.5 font-semibold text-[11px]",
          mine ? "bg-plum-600 text-white" : "bg-surface text-muted",
        )}
      >
        {mine ? "Giliranmu" : "Langkah berikutnya"}
      </span>
      <span className="min-w-0 flex-1 truncate text-ink text-sm">
        {next.label}
      </span>
      <span className="shrink-0 text-muted text-xs">
        {next.responsible.name} · Stage {next.stage}
      </span>
      <ChevronRight className="size-4 shrink-0 text-subtle" />
    </button>
  );
}

function Detail({ activity }: { activity: ActivityItem[] }) {
  const project = useProject();
  const router = useRouter();
  const params = useSearchParams();
  const [assignment, setAssignment] = useState<AssignmentMode | null>(null);
  const [history, setHistory] = useState(false);

  const view = viewFromParams(params);
  const requested = Number(params.get("stage"));
  const stage = isStageNumber(requested)
    ? requested
    : defaultPanelStage(project.stages);

  const navigate = useCallback(
    (changes: Record<string, string | null>) => {
      const search = new URLSearchParams(params.toString());
      for (const [key, value] of Object.entries(changes)) {
        if (value === null) search.delete(key);
        else search.set(key, value);
      }
      router.replace(`?${search.toString()}`, { scroll: false });
    },
    [params, router],
  );
  const selectStage = useCallback(
    (n: number) => navigate({ view: "workflow", stage: String(n), tab: null }),
    [navigate],
  );
  const closeHistory = useCallback(() => setHistory(false), []);

  return (
    <div className="mx-auto max-w-[1180px] space-y-4 px-8 py-6">
      <nav className="flex items-center gap-1.5 text-muted text-xs">
        <Link
          href={project.project.closedAt ? "/projects/past" : "/projects"}
          className="hover:text-plum-600"
        >
          {project.project.closedAt ? "Past Projects" : "Active Projects"}
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-ink">{project.project.name}</span>
      </nav>
      <Header onHistory={() => setHistory(true)} onAssign={setAssignment} />

      <div
        role="tablist"
        aria-label="Bagian project"
        className="flex gap-1 rounded-xl border border-line bg-white p-1 shadow-sm"
      >
        {VIEWS.map((item) => (
          <button
            key={item.key}
            type="button"
            role="tab"
            aria-selected={view === item.key}
            onClick={() =>
              navigate(
                item.key === "workflow"
                  ? { view: "workflow", tab: null }
                  : { view: item.key, tab: null },
              )
            }
            className={cn(
              "flex flex-1 items-center justify-center gap-2 rounded-lg px-3 py-2 font-semibold text-sm transition-colors",
              view === item.key
                ? "bg-plum-600 text-white"
                : "text-muted hover:bg-surface hover:text-ink",
            )}
          >
            <item.icon className="size-4" aria-hidden="true" />
            {item.label}
            {item.key !== "workflow" &&
            project.editableTabs[item.key as DivisionTab] ? (
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  view === item.key ? "bg-white" : "bg-plum-600",
                )}
                title="Kamu bisa mengubah bagian ini"
              />
            ) : null}
          </button>
        ))}
      </div>

      {view === "workflow" ? (
        <>
          <NextStep onSelect={selectStage} />
          <WorkflowStepper selected={stage} onSelect={selectStage} />
          <StagePanel stage={stage} onAssign={setAssignment} />
        </>
      ) : (
        <DivisionView tab={view} onAssign={setAssignment} />
      )}

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
