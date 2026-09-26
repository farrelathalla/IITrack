"use client";

import { Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import {
  addMilestoneAction,
  latestUpdateAction,
  removeMilestoneAction,
  stageDeadlineAction,
  toggleMilestoneAction,
  uatAction,
  warrantyAction,
} from "@/app/(internal)/projects/[code]/actions";
import { labelTone } from "@/components/project/tones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoRow } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import { UAT_STATUS_LABELS, type UatStatus } from "@/lib/project/catalog";
import { WARRANTY_STATUS_LABELS, warrantyStatus } from "@/lib/project/snapshot";
import { daysUntil, formatDate, toDateInput } from "@/lib/time";
import { cn } from "@/lib/utils";
import { ErrorText, InfoGrid } from "./bits";
import { useProject, useRunner } from "./context";

export function LatestUpdateForm() {
  const { project, can } = useProject();
  const { run, pending, error } = useRunner();
  const [open, setOpen] = useState(false);
  if (!can["ops.edit"]) return null;
  return (
    <>
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Pencil className="size-3.5" />
        Isi Latest Update
      </Button>
      <Dialog open={open} onOpenChange={setOpen} title="Latest Update">
        <form
          action={(fd) =>
            run(
              () =>
                latestUpdateAction(project.code, String(fd.get("text") ?? "")),
              () => setOpen(false),
            )
          }
          className="space-y-3"
        >
          <ErrorText error={error} />
          <TextArea
            label="Update terbaru untuk client dan tim"
            name="text"
            rows={4}
            required
            defaultValue={project.techInfo?.latestUpdate ?? ""}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              Simpan
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/** Client-Facing Milestones yang diisi PM (PRD bab 8.3). */
export function MilestonesBlock() {
  const { project, can } = useProject();
  const { run, pending, error } = useRunner();
  const [adding, setAdding] = useState(false);
  const now = new Date();
  const firstOpen = project.milestones.find((m) => !m.doneAt);

  return (
    <div className="space-y-2">
      {project.milestones.length === 0 ? (
        <p className="rounded-lg border border-line border-dashed px-3 py-4 text-center text-subtle text-xs">
          Belum ada milestone.
        </p>
      ) : (
        <div className="rounded-lg border border-line bg-white">
          {project.milestones.map((m) => {
            const state = m.doneAt
              ? "done"
              : m.id === firstOpen?.id
                ? "current"
                : "upcoming";
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 border-surface border-b px-4 py-2.5 last:border-0"
              >
                <button
                  type="button"
                  disabled={!can["ops.edit"] || pending}
                  onClick={() =>
                    run(() => toggleMilestoneAction(project.code, m.id))
                  }
                  aria-label={
                    m.doneAt
                      ? `Buka kembali ${m.name}`
                      : `Tandai ${m.name} selesai`
                  }
                  className={cn(
                    "flex size-5 shrink-0 items-center justify-center rounded-full border-2 disabled:cursor-default",
                    state === "done"
                      ? "border-success-line bg-success-bg"
                      : state === "current"
                        ? "border-plum-600 bg-plum-600"
                        : "border-plum-200 bg-white",
                  )}
                >
                  {state === "done" ? (
                    <Check className="size-3 text-success-text" />
                  ) : state === "current" ? (
                    <span className="size-1.5 rounded-full bg-white" />
                  ) : null}
                </button>
                <p
                  className={cn(
                    "flex-1 text-xs",
                    state === "done" ? "text-muted line-through" : "text-ink",
                  )}
                >
                  {m.name}
                </p>
                <span
                  className={cn(
                    "text-xs",
                    !m.doneAt && daysUntil(m.date, now) < 0
                      ? "font-semibold text-danger-text"
                      : "text-muted",
                  )}
                >
                  {formatDate(m.date)}
                </span>
                <Badge
                  tone={
                    state === "done"
                      ? "success"
                      : state === "current"
                        ? "brand"
                        : "neutral"
                  }
                >
                  {state === "done"
                    ? "Selesai"
                    : state === "current"
                      ? "Sedang Berjalan"
                      : "Akan Datang"}
                </Badge>
                {can["ops.edit"] ? (
                  <button
                    type="button"
                    aria-label={`Hapus ${m.name}`}
                    onClick={() =>
                      run(() => removeMilestoneAction(project.code, m.id))
                    }
                    className="rounded p-1 text-faint hover:text-danger-text"
                  >
                    <Trash2 className="size-3.5" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
      <ErrorText error={adding ? null : error} />
      {can["ops.edit"] ? (
        <Button variant="ghost" size="sm" onClick={() => setAdding(true)}>
          <Plus className="size-3.5" />
          Tambah Milestone
        </Button>
      ) : null}
      <Dialog open={adding} onOpenChange={setAdding} title="Tambah Milestone">
        <form
          action={(fd) =>
            run(
              () =>
                addMilestoneAction(project.code, {
                  name: String(fd.get("name") ?? ""),
                  date: String(fd.get("date") ?? ""),
                }),
              () => setAdding(false),
            )
          }
          className="space-y-3"
        >
          <ErrorText error={error} />
          <TextField
            label="Nama milestone"
            name="name"
            required
            placeholder="UAT, Go Live, …"
          />
          <TextField label="Tanggal" name="date" type="date" required />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              Tambah
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

export function UatControl({ editable }: { editable: boolean }) {
  const { project } = useProject();
  const { run, pending, error } = useRunner();
  const status = project.handover?.uatStatus ?? "NOT_STARTED";
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 rounded-lg border border-line bg-white px-4 py-3">
        <span className="font-medium text-ink text-xs">UAT Status</span>
        {editable ? (
          <select
            aria-label="Status UAT"
            value={status}
            disabled={pending}
            onChange={(e) =>
              run(() => uatAction(project.code, e.target.value as UatStatus))
            }
            className={cn(FIELD_CONTROL, "w-auto py-1 text-xs")}
          >
            {Object.entries(UAT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        ) : (
          <Badge tone={labelTone(UAT_STATUS_LABELS[status])}>
            {UAT_STATUS_LABELS[status]}
          </Badge>
        )}
      </div>
      <ErrorText error={error} />
    </div>
  );
}

/** Garansi: status berubah otomatis dari tanggal (PRD bab 4.10). */
export function WarrantyBlock({ editable }: { editable: boolean }) {
  const { project } = useProject();
  const { run, pending, error } = useRunner();
  const [open, setOpen] = useState(false);
  const status = warrantyStatus(project.handover, new Date());
  const label = WARRANTY_STATUS_LABELS[status];
  return (
    <div className="space-y-2">
      <InfoGrid>
        <InfoRow label="Mulai Garansi">
          {formatDate(project.handover?.warrantyStart)}
        </InfoRow>
        <InfoRow label="Akhir Garansi">
          {formatDate(project.handover?.warrantyEnd)}
        </InfoRow>
        <InfoRow label="Status Garansi">
          <Badge
            tone={
              status === "DONE"
                ? "success"
                : status === "ACTIVE"
                  ? "brand"
                  : "neutral"
            }
          >
            {label}
          </Badge>
        </InfoRow>
      </InfoGrid>
      {editable ? (
        <Button variant="secondary" size="sm" onClick={() => setOpen(true)}>
          {project.handover?.warrantyStart
            ? "Ubah Masa Garansi"
            : "Isi Masa Garansi"}
        </Button>
      ) : null}
      <Dialog open={open} onOpenChange={setOpen} title="Masa Garansi">
        <form
          action={(fd) =>
            run(
              () =>
                warrantyAction(project.code, {
                  warrantyStart: String(fd.get("warrantyStart") ?? ""),
                  warrantyEnd: String(fd.get("warrantyEnd") ?? ""),
                }),
              () => setOpen(false),
            )
          }
          className="space-y-3"
        >
          <ErrorText error={error} />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Mulai garansi"
              name="warrantyStart"
              type="date"
              required
              defaultValue={toDateInput(project.handover?.warrantyStart)}
            />
            <TextField
              label="Akhir garansi"
              name="warrantyEnd"
              type="date"
              required
              defaultValue={toDateInput(project.handover?.warrantyEnd)}
            />
          </div>
          <p className="text-[11px] text-subtle">
            Status garansi berubah otomatis dari tanggal.
          </p>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              Simpan
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

/** Tenggat stage yang bisa diatur PM, muncul di baris Deadline panel stage. */
export function StageDeadline({ stage }: { stage: number }) {
  const { project, can, stages } = useProject();
  const state = stages.find((s) => s.n === stage);
  const { run, pending, error } = useRunner();
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="flex items-center gap-2">
        <p className="font-medium text-ink text-xs">
          {formatDate(state?.deadline)}
        </p>
        {can["ops.edit"] && state?.status !== "completed" ? (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="text-plum-600 text-xs hover:underline"
          >
            Atur
          </button>
        ) : null}
      </div>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title={`Deadline Stage ${stage}`}
      >
        <form
          action={(fd) =>
            run(
              () =>
                stageDeadlineAction(
                  project.code,
                  stage,
                  String(fd.get("deadline") ?? ""),
                ),
              () => setOpen(false),
            )
          }
          className="space-y-3"
        >
          <ErrorText error={error} />
          <TextField
            label="Deadline"
            name="deadline"
            type="date"
            defaultValue={toDateInput(state?.deadline)}
            hint="Kosongkan untuk menghapus deadline."
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              Simpan
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
