"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Pencil,
  Plus,
  UserPlus,
  Users,
} from "lucide-react";
import { useState } from "react";
import {
  addBlockerAction,
  resolveBlockerAction,
  submitStaffingAction,
  updateTechInfoAction,
} from "@/app/(internal)/projects/[code]/actions";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoRow } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import { developersOf, pmOf } from "@/lib/project/snapshot";
import { formatDate, formatDateTimeShort, toDateInput } from "@/lib/time";
import type { AssignmentMode } from "./assignment-modal";
import { ErrorText, ExternalAnchor, InfoGrid, Subsection } from "./bits";
import { useProject, useRunner } from "./context";

const STAFFING_LABEL = {
  WAITING_TECHDEV: "Menunggu TechDev",
  DEVELOPER_ASSIGNED: "Developer Assigned",
} as const;

/** Request SDM beserta daftar developer yang ditugaskan (PRD bab 4.7). */
export function StaffingBlock({
  onAssign,
}: {
  onAssign: (mode: AssignmentMode) => void;
}) {
  const { project, can } = useProject();
  const { run, pending, error } = useRunner();
  const [editing, setEditing] = useState(false);
  const staffing = project.staffing;
  const developers = developersOf(project);
  const statusLabel = staffing
    ? STAFFING_LABEL[staffing.status]
    : "Request Belum Diajukan";

  function submit(formData: FormData) {
    run(
      () =>
        submitStaffingAction(project.code, {
          technicalNeeds: String(formData.get("technicalNeeds") ?? ""),
          roleRequested: String(formData.get("roleRequested") ?? ""),
          headcount: String(formData.get("headcount") ?? ""),
          neededBy: String(formData.get("neededBy") ?? ""),
        }),
      () => setEditing(false),
    );
  }

  const canRequest =
    can["staffing.submit"] && staffing?.status !== "DEVELOPER_ASSIGNED";

  return (
    <div className="space-y-3">
      <InfoGrid>
        <InfoRow label="Project">{`${project.code} · ${project.name}`}</InfoRow>
        <InfoRow label="Client">{project.client}</InfoRow>
        <InfoRow label="PM">{pmOf(project)?.name ?? "-"}</InfoRow>
        <InfoRow label="Status Request">
          <Badge
            tone={
              staffing?.status === "DEVELOPER_ASSIGNED"
                ? "success"
                : staffing
                  ? "warning"
                  : "neutral"
            }
          >
            {statusLabel}
          </Badge>
        </InfoRow>
        {staffing ? (
          <>
            <InfoRow label="Role Diminta">{`${staffing.roleRequested} (${staffing.headcount} orang)`}</InfoRow>
            <InfoRow label="Tanggal Dibutuhkan">
              {formatDate(staffing.neededBy)}
            </InfoRow>
            <InfoRow label="Kebutuhan Teknis">
              <span className="whitespace-pre-line font-normal">
                {staffing.technicalNeeds}
              </span>
            </InfoRow>
            <InfoRow label="Assigned By">
              {staffing.assignedByName ? `${staffing.assignedByName}` : "-"}
            </InfoRow>
          </>
        ) : null}
      </InfoGrid>

      <div className="flex flex-wrap gap-2">
        {canRequest ? (
          <Button
            variant={staffing ? "secondary" : "primary"}
            onClick={() => setEditing(true)}
          >
            {staffing ? (
              <Pencil className="size-3.5" />
            ) : (
              <Users className="size-3.5" />
            )}
            {staffing ? "Perbarui Request SDM" : "Isi Request SDM"}
          </Button>
        ) : null}
        {can["developer.assign"] && staffing ? (
          <Button onClick={() => onAssign({ kind: "developer-add" })}>
            <UserPlus className="size-3.5" />
            {developers.length === 0
              ? "Tugaskan Developer"
              : "Tambah Developer"}
          </Button>
        ) : null}
        {can["developer.assign"] && !staffing ? (
          <span className="text-subtle text-xs">
            Menunggu PM mengirim Request SDM.
          </span>
        ) : null}
      </div>

      {developers.length > 0 ? (
        <Subsection title="Developer yang Ditugaskan">
          <div className="space-y-2">
            {developers.map((dev) => (
              <div
                key={dev.userId}
                className="flex items-center gap-3 rounded-lg border border-line bg-white px-3 py-2"
              >
                <Avatar name={dev.name} size="md" />
                <div className="flex-1">
                  <p className="font-semibold text-ink text-sm">{dev.name}</p>
                  <p className="text-[11px] text-subtle">
                    {dev.techRole ?? "Tech Developer"}
                  </p>
                </div>
                <Badge tone={dev.userActive ? "success" : "danger"}>
                  {dev.userActive ? "Aktif" : "Tidak aktif"}
                </Badge>
                {can["developer.assign"] ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onAssign({
                        kind: "developer-replace",
                        previousUserId: dev.userId,
                        previousName: dev.name,
                      })
                    }
                  >
                    Ganti Developer
                  </Button>
                ) : null}
              </div>
            ))}
          </div>
        </Subsection>
      ) : null}

      <Dialog open={editing} onOpenChange={setEditing} title="Request SDM">
        <form action={submit} className="space-y-3">
          <ErrorText error={error} />
          <TextArea
            label="Kebutuhan teknis"
            name="technicalNeeds"
            required
            rows={3}
            defaultValue={staffing?.technicalNeeds}
            placeholder="Stack, modul, dan konteks teknis project"
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField
              label="Role yang diminta"
              name="roleRequested"
              required
              defaultValue={staffing?.roleRequested ?? ""}
              placeholder="Full-stack Developer"
            />
            <TextField
              label="Jumlah orang"
              name="headcount"
              type="number"
              min={1}
              required
              defaultValue={staffing?.headcount ?? 1}
            />
          </div>
          <TextField
            label="Tanggal dibutuhkan"
            name="neededBy"
            type="date"
            required
            defaultValue={toDateInput(staffing?.neededBy)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setEditing(false)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Mengirim…" : "Kirim Request SDM"}
            </Button>
          </div>
        </form>
      </Dialog>
    </div>
  );
}

/** GitHub Repository dan Sprint Planning; kode tetap di GitHub, hanya ditautkan. */
export function TechReferences() {
  const { project, can } = useProject();
  const [open, setOpen] = useState(false);
  const { run, pending, error } = useRunner();
  const tech = project.techInfo;

  return (
    <div className="grid grid-cols-2 gap-3">
      {[
        { label: "GitHub Repository", value: tech?.githubRepo },
        { label: "Sprint Planning", value: tech?.sprintPlanning },
      ].map((item) => (
        <div
          key={item.label}
          className="rounded-lg border border-line bg-white p-3.5"
        >
          <p className="mb-1.5 font-semibold text-[11px] text-muted uppercase tracking-wider">
            {item.label}
          </p>
          <div className="flex items-center justify-between gap-2 text-xs">
            {item.value ? (
              <ExternalAnchor href={item.value}>
                {item.value.replace(/^https?:\/\//, "")}
              </ExternalAnchor>
            ) : (
              <Badge tone="danger">Belum Ditambahkan</Badge>
            )}
            {can["tech.edit"] ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setOpen(true)}
              >
                {item.value ? "Ganti Link" : "Tambah Link"}
              </Button>
            ) : null}
          </div>
        </div>
      ))}
      <Dialog open={open} onOpenChange={setOpen} title="Referensi Teknis">
        <form
          action={(formData) =>
            run(
              () =>
                updateTechInfoAction(project.code, {
                  githubRepo: String(formData.get("githubRepo") ?? ""),
                  sprintPlanning: String(formData.get("sprintPlanning") ?? ""),
                }),
              () => setOpen(false),
            )
          }
          className="space-y-3"
        >
          <ErrorText error={error} />
          <TextField
            label="GitHub Repository"
            name="githubRepo"
            type="url"
            defaultValue={tech?.githubRepo ?? ""}
            placeholder="https://github.com/…"
          />
          <TextField
            label="Sprint Planning"
            name="sprintPlanning"
            type="url"
            defaultValue={tech?.sprintPlanning ?? ""}
            placeholder="Notion atau GitHub Projects"
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
    </div>
  );
}

/** Technical Progress: sprint, progres, blocker, next milestone (PRD bab 4.9). */
export function TechProgress({ showBar = true }: { showBar?: boolean }) {
  const { project, can } = useProject();
  const [dialog, setDialog] = useState<"progress" | "blocker" | null>(null);
  const { run, pending, error } = useRunner();
  const tech = project.techInfo;
  const open = project.blockers.filter((b) => !b.resolvedAt);
  const progress = tech?.progressPercent ?? null;

  return (
    <div className="space-y-3">
      <InfoGrid>
        <InfoRow label="Sprint Saat Ini">{tech?.currentSprint ?? "-"}</InfoRow>
        <InfoRow label="Progress Summary">
          {progress !== null ? `${progress}% fitur selesai` : "-"}
        </InfoRow>
        <InfoRow label="Technical Blockers">
          {open.length === 0 ? "Tidak ada" : `${open.length} terbuka`}
        </InfoRow>
        <InfoRow label="Next Milestone">{tech?.nextMilestone ?? "-"}</InfoRow>
        <InfoRow label="Latest Update">
          {tech?.latestUpdateAt
            ? `${formatDateTimeShort(tech.latestUpdateAt)}`
            : "-"}
        </InfoRow>
      </InfoGrid>
      {tech?.latestUpdate ? (
        <p className="rounded-lg bg-surface px-3 py-2 text-ink text-xs leading-relaxed">
          <span className="font-semibold">Latest update PM:</span>{" "}
          {tech.latestUpdate}
        </p>
      ) : null}

      {showBar && progress !== null ? (
        <div>
          <div className="mb-1 flex justify-between text-xs">
            <span className="font-medium text-muted">
              Overall Sprint Progress
            </span>
            <span className="font-bold text-plum-600">{progress}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-plum-600"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      ) : null}

      {project.blockers.length > 0 ? (
        <div className="space-y-1.5">
          {project.blockers.map((blocker) => (
            <div
              key={blocker.id}
              className="flex items-start gap-2 rounded-lg border border-line bg-white px-3 py-2 text-xs"
            >
              {blocker.resolvedAt ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0 text-success-text" />
              ) : (
                <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-warning-dot" />
              )}
              <div className="flex-1">
                <p
                  className={
                    blocker.resolvedAt ? "text-muted line-through" : "text-ink"
                  }
                >
                  {blocker.description}
                </p>
                <p className="text-[10px] text-subtle">
                  {blocker.createdByName} ·{" "}
                  {formatDateTimeShort(blocker.createdAt)}
                </p>
              </div>
              {!blocker.resolvedAt && can["tech.edit"] ? (
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() =>
                    run(() => resolveBlockerAction(project.code, blocker.id))
                  }
                >
                  Selesaikan
                </Button>
              ) : null}
            </div>
          ))}
        </div>
      ) : null}

      <ErrorText error={dialog ? null : error} />
      {can["tech.edit"] ? (
        <div className="flex gap-2">
          <Button onClick={() => setDialog("progress")}>Update Progress</Button>
          <Button variant="secondary" onClick={() => setDialog("blocker")}>
            <Plus className="size-3.5" />
            Tambah Technical Blocker
          </Button>
        </div>
      ) : null}

      <Dialog
        open={dialog === "progress"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Update Progress"
      >
        <form
          action={(formData) =>
            run(
              () =>
                updateTechInfoAction(project.code, {
                  currentSprint: String(formData.get("currentSprint") ?? ""),
                  progressPercent: String(
                    formData.get("progressPercent") ?? "",
                  ),
                  nextMilestone: String(formData.get("nextMilestone") ?? ""),
                }),
              () => setDialog(null),
            )
          }
          className="space-y-3"
        >
          <ErrorText error={error} />
          <TextField
            label="Sprint saat ini"
            name="currentSprint"
            defaultValue={tech?.currentSprint ?? ""}
            placeholder="Sprint 4 (18-25 Sep)"
          />
          <TextField
            label="Progress (%)"
            name="progressPercent"
            type="number"
            min={0}
            max={100}
            defaultValue={tech?.progressPercent ?? ""}
          />
          <TextField
            label="Next milestone"
            name="nextMilestone"
            defaultValue={tech?.nextMilestone ?? ""}
            placeholder="UAT, 30 Sep 2026"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              Simpan
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={dialog === "blocker"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Tambah Technical Blocker"
      >
        <form
          action={(formData) =>
            run(
              () =>
                addBlockerAction(
                  project.code,
                  String(formData.get("description") ?? ""),
                ),
              () => setDialog(null),
            )
          }
          className="space-y-3"
        >
          <ErrorText error={error} />
          <TextArea
            label="Deskripsi hambatan"
            name="description"
            required
            rows={3}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>
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
