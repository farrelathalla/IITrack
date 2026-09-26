import { CalendarDays, ChevronRight, SquareCheck } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { StageProgress } from "@/components/ui/progress";
import { stageDefinition, TOTAL_STAGES } from "@/lib/project/catalog";
import { pmOf } from "@/lib/project/snapshot";
import { PROJECT_STATUS_LABELS } from "@/lib/project/status";
import { formatDayMonth } from "@/lib/time";
import type { ProjectListItem } from "@/server/project/queries";
import { ProjectIdChip } from "./status-chip";

/**
 * Kartu "Project Sedang Berjalan" di Dashboard (PRD bab 8.1): Project ID,
 * status, nama, client, PM, blok Stage, Deadline Terdekat, Next Action, dan
 * penanggung jawab saat ini.
 */
export function ProjectCard({ item }: { item: ProjectListItem }) {
  const { project, summary } = item;
  const pm = pmOf(project);
  const stage = stageDefinition(summary.current.n);
  const deadline = summary.nearestDeadline;
  const next = summary.nextAction;

  return (
    <Link
      href={`/projects/${project.code}`}
      className="group block rounded-xl border border-line bg-white shadow-sm transition-[border-color,box-shadow] duration-200 ease-(--ease-out) hover:border-plum-200 hover:shadow-md"
    >
      <div className="p-5">
        <div className="flex items-start gap-5">
          <div className="min-w-0 flex-1">
            <div className="mb-1.5 flex items-center gap-2">
              <ProjectIdChip code={project.code} />
              {summary.status ? (
                <Badge tone="neutral" dot>
                  {PROJECT_STATUS_LABELS[summary.status]}
                </Badge>
              ) : null}
            </div>
            <h3 className="font-bold text-sm text-ink transition-colors group-hover:text-plum-600">
              {project.name}
            </h3>
            <div className="mt-1.5 flex flex-wrap items-center gap-3 text-muted text-xs">
              <span>
                Client:{" "}
                <strong className="font-medium text-ink">
                  {project.client}
                </strong>
              </span>
              <span className="text-line">·</span>
              <span className="flex items-center gap-1">
                {pm ? <Avatar name={pm.name} /> : null}
                PM:{" "}
                <strong className="font-medium text-ink">
                  {pm?.name.split(" ")[0] ?? "-"}
                </strong>
              </span>
            </div>
          </div>

          <div className="w-52 shrink-0">
            <div className="mb-1.5 flex items-center justify-between">
              <span className="font-semibold text-[11px] text-muted uppercase tracking-wider">
                Stage
              </span>
              <span className="text-[11px] text-muted">
                Stage {stage.n}/{TOTAL_STAGES}
              </span>
            </div>
            <div className="mb-2 font-semibold text-ink text-sm">
              {stage.shortName}
            </div>
            <StageProgress value={summary.completed} total={TOTAL_STAGES} />
          </div>

          <div className="w-60 shrink-0 border-surface-2 border-l pl-5">
            <div className="mb-2">
              <div className="mb-0.5 flex items-center gap-1.5">
                <CalendarDays className="size-3 text-subtle" />
                <span className="font-semibold text-[10px] text-subtle uppercase tracking-wider">
                  Deadline Terdekat
                </span>
              </div>
              <p className="font-medium text-ink text-xs">
                {deadline
                  ? `${deadline.label}: ${formatDayMonth(deadline.date)}`
                  : "-"}
              </p>
            </div>
            <div>
              <div className="mb-0.5 flex items-center gap-1.5">
                <SquareCheck className="size-3 text-plum-500" />
                <span className="font-semibold text-[10px] text-subtle uppercase tracking-wider">
                  Next Action
                </span>
              </div>
              <p className="text-muted text-xs leading-relaxed">
                {next?.label ?? "-"}
              </p>
            </div>
          </div>

          <ChevronRight className="size-4 shrink-0 self-center text-faint transition-colors group-hover:text-plum-600" />
        </div>

        {next ? (
          <div className="mt-3 flex items-center gap-2 border-surface border-t pt-3">
            <span className="text-[10px] text-subtle">
              Penanggung jawab saat ini:
            </span>
            <Avatar
              name={next.responsible.name}
              group={!next.responsible.userId}
            />
            <span className="font-medium text-[11px] text-muted">
              {next.responsible.name}
            </span>
            <span className="text-[10px] text-subtle">·</span>
            <span className="text-[10px] text-subtle">
              {next.responsible.divisionLabel}
            </span>
          </div>
        ) : null}
      </div>
    </Link>
  );
}
