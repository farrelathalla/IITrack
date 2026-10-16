"use client";

import { ChevronDown, History, UserCog } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  deleteProjectAction,
  updateProjectDetailsAction,
} from "@/app/(internal)/projects/[code]/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import { isCLevel } from "@/lib/auth/roles";
import {
  PROJECT_SOURCE_LABELS,
  PROJECT_TYPE_LABELS,
} from "@/lib/project/catalog";
import { toDateInput } from "@/lib/time";
import type { AssignmentMode } from "./assignment-modal";
import { ErrorText } from "./bits";
import { useProject, useRunner } from "./context";

export function ProjectDetailsMenu({
  onHistory,
  onAssign,
}: {
  onHistory: () => void;
  onAssign: (mode: AssignmentMode) => void;
}) {
  const { project, viewer, can } = useProject();
  const router = useRouter();
  const [open, setOpen] = useState<"edit" | "delete" | null>(null);
  const { run, pending, error } = useRunner();
  const canManage = viewer.role === "COO" || viewer.role === "VICE_COO";
  const canDelete = canManage && !project.closedAt && !project.stage1DoneAt;
  const showApprovers = viewer.role === "SUPER_ADMIN" || isCLevel(viewer.role);

  return (
    <>
      <details className="relative">
        <summary className="inline-flex h-8 cursor-pointer list-none items-center gap-1 rounded-lg border border-plum-200 bg-white px-3 font-medium text-muted text-xs hover:bg-surface hover:text-ink [&::-webkit-details-marker]:hidden">
          Kelola
          <ChevronDown className="size-3.5" />
        </summary>
        <div className="absolute right-0 z-20 mt-1 w-56 rounded-lg border border-line bg-white p-1 shadow-sm">
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-ink text-xs hover:bg-surface"
            onClick={onHistory}
          >
            <History className="size-3.5" />
            Riwayat Aktivitas
          </button>
          {can["project.assignPm"] ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-ink text-xs hover:bg-surface"
              onClick={() => onAssign({ kind: "pm" })}
            >
              <UserCog className="size-3.5" />
              Ganti PM
            </button>
          ) : null}
          {canManage && !project.closedAt ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-ink text-xs hover:bg-surface"
              onClick={() => setOpen("edit")}
            >
              Edit detail awal
            </button>
          ) : null}
          {canDelete ? (
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-danger-text text-xs hover:bg-danger-bg"
              onClick={() => setOpen("delete")}
            >
              Hapus project
            </button>
          ) : null}
          {showApprovers ? (
            <Link
              href="/settings/workflow"
              className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-ink text-xs hover:bg-surface"
            >
              Atur approver
            </Link>
          ) : null}
        </div>
      </details>

      {canManage && !project.closedAt ? (
        <Dialog
          open={open === "edit"}
          onOpenChange={(next) => !next && setOpen(null)}
          title="Edit detail awal"
        >
          <form
            className="space-y-3"
            action={(formData) =>
              run(
                () =>
                  updateProjectDetailsAction(project.code, {
                    name: String(formData.get("name") ?? ""),
                    client: String(formData.get("client") ?? ""),
                    type: String(formData.get("type") ?? ""),
                    source: String(formData.get("source") ?? ""),
                    targetStart: String(formData.get("targetStart") ?? ""),
                    targetEnd: String(formData.get("targetEnd") ?? ""),
                    internalNote: String(formData.get("internalNote") ?? ""),
                  }),
                () => setOpen(null),
              )
            }
          >
            <ErrorText error={error} />
            <TextField
              label="Nama"
              name="name"
              required
              defaultValue={project.name}
            />
            <TextField
              label="Client"
              name="client"
              required
              defaultValue={project.client}
            />
            <TextField
              label="Target mulai"
              name="targetStart"
              type="date"
              required
              defaultValue={toDateInput(project.targetStart)}
            />
            <TextField
              label="Target selesai"
              name="targetEnd"
              type="date"
              required
              defaultValue={toDateInput(project.targetEnd)}
            />
            <label className="flex flex-col gap-1 text-xs">
              Jenis
              <select
                name="type"
                defaultValue={project.type ?? ""}
                className="rounded-lg border border-line px-3 py-2"
              >
                <option value="">-</option>
                {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-xs">
              Sumber
              <select
                name="source"
                defaultValue={project.source ?? ""}
                className="rounded-lg border border-line px-3 py-2"
              >
                <option value="">-</option>
                {Object.entries(PROJECT_SOURCE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <TextArea
              label="Catatan internal"
              name="internalNote"
              defaultValue={project.internalNote ?? ""}
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(null)}>
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                Simpan
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {canDelete ? (
        <Dialog
          open={open === "delete"}
          onOpenChange={(next) => !next && setOpen(null)}
          title="Hapus project"
        >
          <div className="space-y-3">
            <ErrorText error={error} />
            <p className="text-ink text-sm">
              {project.name} akan hilang dari daftar. Riwayat aktivitas tetap
              tersimpan. Ini hanya untuk project yang stage 1-nya belum selesai.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setOpen(null)}>
                Batal
              </Button>
              <Button
                variant="danger"
                disabled={pending}
                onClick={() =>
                  run(
                    () => deleteProjectAction(project.code),
                    () => router.push("/projects"),
                  )
                }
              >
                Hapus
              </Button>
            </div>
          </div>
        </Dialog>
      ) : null}
    </>
  );
}
