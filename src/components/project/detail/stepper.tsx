"use client";

import { Check, Lock, X } from "lucide-react";
import { STAGE_TONE } from "@/components/project/tones";
import { TONE_DOT } from "@/components/ui/badge";
import { stageDefinition } from "@/lib/project/catalog";
import { STAGE_STATUS_LABELS, type StageStatus } from "@/lib/project/stages";
import { cn } from "@/lib/utils";
import { useProject } from "./context";

const BORDER: Record<StageStatus, string> = {
  completed: "border-success-text",
  approved: "border-success-text",
  "in-progress": "border-plum-600",
  "waiting-approval": "border-warning-dot",
  "revision-required": "border-red-400",
  "not-started": "border-line",
  locked: "border-line",
};

/**
 * Alur Workflow Project: stepper sembilan node, garis hijau untuk stage selesai,
 * dan legenda status (PRD bab 8.3). Klik node membuka panel stage.
 */
export function WorkflowStepper({
  selected,
  onSelect,
}: {
  selected: number;
  onSelect: (n: number) => void;
}) {
  const { stages } = useProject();

  return (
    <div className="rounded-xl border border-line bg-white p-5 shadow-sm">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-bold text-ink text-sm">Alur Workflow Project</h2>
        <span className="text-[11px] text-subtle">
          9 stage global · pilih untuk detail
        </span>
      </div>
      <div className="flex items-start">
        {stages.map((stage, index) => {
          const def = stageDefinition(stage.n);
          const done =
            stage.status === "completed" || stage.status === "approved";
          const locked = stage.status === "locked";
          const revision = stage.status === "revision-required";
          const active = stage.n === selected;
          return (
            <div
              key={stage.n}
              className="flex flex-1 items-start last:flex-none"
            >
              <button
                type="button"
                onClick={() => onSelect(stage.n)}
                aria-current={active ? "step" : undefined}
                aria-label={`Stage ${stage.n} ${def.name}: ${STAGE_STATUS_LABELS[stage.status]}`}
                className="group flex w-20 flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    "relative flex size-10 items-center justify-center rounded-full border-2 bg-white transition-all",
                    done && "bg-success-bg",
                    revision && "bg-danger-bg",
                    active
                      ? cn(BORDER[stage.status], "scale-110 shadow-md")
                      : "border-line group-hover:border-plum-200",
                    !active && done && "border-success-line",
                    !active && revision && "border-danger-line",
                    locked && "opacity-40",
                  )}
                >
                  {done ? (
                    <Check className="size-4 text-success-text" />
                  ) : locked ? (
                    <Lock className="size-3.5 text-subtle" />
                  ) : revision ? (
                    <X className="size-4 text-danger-text" />
                  ) : (
                    <span
                      className={cn(
                        "font-bold text-sm",
                        stage.status === "in-progress" || active
                          ? "text-plum-600"
                          : stage.status === "waiting-approval"
                            ? "text-warning-text"
                            : "text-subtle",
                      )}
                    >
                      {stage.n}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-center font-medium text-[11px] leading-tight",
                    active
                      ? "text-plum-600"
                      : locked
                        ? "text-faint"
                        : "text-muted group-hover:text-ink",
                  )}
                >
                  {def.shortName}
                </span>
                {active ? (
                  <span className="h-0.5 w-6 rounded-full bg-plum-600" />
                ) : null}
              </button>
              {index < stages.length - 1 ? (
                <div
                  className={cn(
                    "mt-5 h-0.5 flex-1",
                    done ? "bg-success-text" : "bg-line",
                  )}
                />
              ) : null}
            </div>
          );
        })}
      </div>
      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1.5 border-surface border-t pt-4">
        {(Object.keys(STAGE_STATUS_LABELS) as StageStatus[]).map((status) => (
          <span
            key={status}
            className="flex items-center gap-1.5 text-[11px] text-muted"
          >
            <span
              className={cn(
                "size-2 rounded-full",
                TONE_DOT[STAGE_TONE[status]],
              )}
            />
            {STAGE_STATUS_LABELS[status]}
          </span>
        ))}
      </div>
    </div>
  );
}
