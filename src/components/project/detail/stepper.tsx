"use client";

import { Check, Lock, PenLine, X } from "lucide-react";
import { stageDefinition } from "@/lib/project/catalog";
import { STAGE_STATUS_LABELS, type StageStatus } from "@/lib/project/stages";
import { cn } from "@/lib/utils";
import { useProject } from "./context";

const BORDER: Record<StageStatus, string> = {
  completed: "border-success-text",
  approved: "border-warning-dot",
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
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-bold text-ink text-sm">Alur Workflow</h2>
        <span className="text-[11px] text-subtle">
          Klik stage untuk melihat isinya
        </span>
      </div>
      <div className="flex items-start">
        {stages.map((stage, index) => {
          const def = stageDefinition(stage.n);
          // Hanya stage yang benar-benar selesai yang dicentang. Stage yang
          // dokumennya sudah disetujui tetapi belum ditandatangani belum lanjut.
          const done = stage.status === "completed";
          const locked = stage.status === "locked";
          // Disetujui tetapi belum lanjut: tinggal tanda tangan (Stage 3 dan 4).
          const signing = stage.status === "approved";
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
                title={`${def.name}: ${STAGE_STATUS_LABELS[stage.status]}`}
                className="group flex w-20 flex-col items-center gap-1.5"
              >
                <span
                  className={cn(
                    "relative flex size-10 items-center justify-center rounded-full border-2 bg-white transition-[transform,border-color,box-shadow] duration-200 ease-(--ease-out)",
                    done && "bg-success-bg",
                    revision && "bg-danger-bg",
                    signing && "bg-warning-bg",
                    active
                      ? cn(BORDER[stage.status], "scale-110 shadow-md")
                      : "border-line group-hover:border-plum-200",
                    !active && done && "border-success-line",
                    !active && revision && "border-danger-line",
                    !active && signing && "border-warning-line",
                    locked && "opacity-40",
                  )}
                >
                  {done ? (
                    <Check className="size-4 text-success-text" />
                  ) : locked ? (
                    <Lock className="size-3.5 text-subtle" />
                  ) : revision ? (
                    <X className="size-4 text-danger-text" />
                  ) : signing ? (
                    <PenLine className="size-4 text-warning-text" />
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
    </div>
  );
}
