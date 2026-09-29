"use client";

import { MoreHorizontal, Pencil, Trash2, UserCog } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  deleteProjectAction,
  updateDetailsAction,
} from "@/app/(internal)/projects/[code]/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { SelectField } from "@/components/ui/select-field";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import {
  PROJECT_SOURCE_LABELS,
  PROJECT_TYPE_LABELS,
} from "@/lib/project/catalog";
import { toDateInput } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { AssignmentMode } from "./assignment-modal";
import { ErrorText } from "./bits";
import { useProject, useRunner } from "./context";

/**
 * Menu aksi project di header: Edit Detail, Ganti PM, dan Hapus Project.
 * Hanya item yang boleh dilakukan pengguna yang tampil; server tetap
 * memeriksa ulang izinnya.
 */
export function ProjectActionsMenu({
  onAssign,
}: {
  onAssign: (mode: AssignmentMode) => void;
}) {
  const { can } = useProject();
  const [open, setOpen] = useState(false);
  const [dialog, setDialog] = useState<"edit" | "delete" | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent) {
        if (event.key === "Escape") setOpen(false);
        return;
      }
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", close);
    };
  }, [open]);

  const items = [
    can["project.edit"]
      ? {
          key: "edit",
          label: "Edit Detail Project",
          icon: Pencil,
          danger: false,
          onClick: () => setDialog("edit"),
        }
      : null,
    can["project.assignPm"]
      ? {
          key: "pm",
          label: "Ganti PM",
          icon: UserCog,
          danger: false,
          onClick: () => onAssign({ kind: "pm" }),
        }
      : null,
    can["project.delete"]
      ? {
          key: "delete",
          label: "Hapus Project",
          icon: Trash2,
          danger: true,
          onClick: () => setDialog("delete"),
        }
      : null,
  ].filter((item) => item !== null);

  if (items.length === 0) return null;

  return (
    <div ref={ref} className="relative">
      <Button
        variant="secondary"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <MoreHorizontal className="size-4" />
        Kelola
      </Button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-1 w-52 overflow-hidden rounded-lg border border-line bg-white py-1 shadow-lg"
        >
          {items.map((item) => (
            <button
              key={item.key}
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false);
                item.onClick();
              }}
              className={cn(
                "flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface",
                item.danger ? "text-danger-text" : "text-ink",
              )}
            >
              <item.icon className="size-3.5" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </div>
      ) : null}
      {dialog === "edit" ? (
        <EditDetailsDialog onClose={() => setDialog(null)} />
      ) : null}
      {dialog === "delete" ? (
        <DeleteProjectDialog onClose={() => setDialog(null)} />
      ) : null}
    </div>
  );
}

function EditDetailsDialog({ onClose }: { onClose: () => void }) {
  const { project } = useProject();
  const { run, pending, error } = useRunner();

  function submit(formData: FormData) {
    const field = (name: string) => String(formData.get(name) ?? "");
    run(
      () =>
        updateDetailsAction(project.code, {
          name: field("name"),
          client: field("client"),
          type: field("type"),
          source: field("source"),
          targetStart: field("targetStart"),
          targetEnd: field("targetEnd"),
          internalNote: field("internalNote"),
        }),
      onClose,
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Edit Detail Project"
    >
      <form action={submit} className="space-y-3">
        <ErrorText error={error} />
        <p className="text-subtle text-xs">
          Project ID {project.code} tidak berubah. Setiap perubahan dicatat di
          Riwayat Aktivitas.
        </p>
        <TextField
          label="Nama project"
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
        <div className="grid grid-cols-2 gap-3">
          <SelectField
            label="Tipe"
            name="type"
            defaultValue={project.type ?? ""}
          >
            <option value="">Belum dipilih</option>
            {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Sumber"
            name="source"
            defaultValue={project.source ?? ""}
          >
            <option value="">Belum dipilih</option>
            {Object.entries(PROJECT_SOURCE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="grid grid-cols-2 gap-3">
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
        </div>
        <TextArea
          label="Catatan internal"
          name="internalNote"
          rows={3}
          defaultValue={project.internalNote ?? ""}
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Menyimpan…" : "Simpan"}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function DeleteProjectDialog({ onClose }: { onClose: () => void }) {
  const { project } = useProject();
  const { run, pending, error } = useRunner();
  const [reason, setReason] = useState("");
  const [confirm, setConfirm] = useState("");

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title="Hapus Project"
    >
      <div className="space-y-3">
        <ErrorText error={error} />
        <p className="text-ink text-xs leading-relaxed">
          <strong>{project.name}</strong> akan hilang dari semua daftar dan
          tidak bisa dibuka lagi. Riwayat aktivitasnya tetap tersimpan dan
          Project ID {project.code} tidak dipakai ulang. Orang yang ditugaskan
          akan diberi tahu.
        </p>
        <TextArea
          label="Alasan penghapusan"
          name="reason"
          required
          rows={3}
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Misalnya: project batal, client tidak melanjutkan."
        />
        <TextField
          label={`Ketik ${project.code} untuk konfirmasi`}
          name="confirm"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          autoComplete="off"
        />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button
            variant="danger"
            disabled={
              pending || reason.trim() === "" || confirm.trim() !== project.code
            }
            onClick={() => run(() => deleteProjectAction(project.code, reason))}
          >
            <Trash2 className="size-3.5" />
            {pending ? "Menghapus…" : "Hapus Project"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
