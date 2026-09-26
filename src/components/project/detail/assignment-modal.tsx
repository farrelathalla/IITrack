"use client";

import { Info, Plus, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  assignDevelopersAction,
  assignFinancePocAction,
  assignPmAction,
  candidatesAction,
  replaceDeveloperAction,
} from "@/app/(internal)/projects/[code]/actions";
import { PersonPicker } from "@/components/project/person-picker";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/text-field";
import type { ProjectRole } from "@/lib/auth/types";
import type { Candidate } from "@/server/project/people";
import { ErrorText } from "./bits";
import { useProject, useRunner } from "./context";

export type AssignmentMode =
  | { kind: "pm" }
  | { kind: "developer-add" }
  | { kind: "developer-replace"; previousUserId: string; previousName: string }
  | { kind: "finance" };

const INFO: Record<
  AssignmentMode["kind"],
  { role: ProjectRole; title: string; peran: string; access: string }
> = {
  pm: {
    role: "PM",
    title: "Ganti Project Manager",
    peran: "Project Manager",
    access:
      "Orang ini akan mendapat akses edit pada tab Project Manager dan aksi Operasional project ini. Hak edit PM lama berakhir seketika.",
  },
  "developer-add": {
    role: "DEVELOPER",
    title: "Tugaskan Developer",
    peran: "Developer",
    access:
      "Orang ini akan mendapat akses edit pada tab Technology Dev project ini.",
  },
  "developer-replace": {
    role: "DEVELOPER",
    title: "Ganti Developer",
    peran: "Developer",
    access:
      "Developer pengganti mendapat akses edit pada tab Technology Dev. Kontrak Programmer developer lama tetap tersimpan.",
  },
  finance: {
    role: "FINANCE_POC",
    title: "Tunjuk Finance POC",
    peran: "Finance POC",
    access:
      "Orang ini akan mendapat akses edit status pembayaran pada tab Finance project ini.",
  },
};

/**
 * Satu modal penugasan untuk Ganti PM (COO/VCOO), Tambah dan Ganti Developer
 * (CTO/VCTO), serta Tunjuk dan Ganti Finance POC (CFO/VCFO) (PRD bab 8.4).
 */
export function AssignmentModal({
  mode,
  onClose,
}: {
  mode: AssignmentMode | null;
  onClose: () => void;
}) {
  const { project } = useProject();
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const nextKey = useRef(1);
  const [picked, setPicked] = useState<
    { key: number; userId: string; techRole: string }[]
  >([{ key: 0, userId: "", techRole: "" }]);
  const { run, pending, error, setError } = useRunner();
  const info = mode ? INFO[mode.kind] : null;
  const isDeveloper =
    mode?.kind === "developer-add" || mode?.kind === "developer-replace";

  useEffect(() => {
    if (!info) return;
    setCandidates(null);
    setError(null);
    setPicked([
      { key: 0, userId: "", techRole: project.staffing?.roleRequested ?? "" },
    ]);
    let active = true;
    candidatesAction(info.role).then((list) => {
      if (active) setCandidates(list);
    });
    return () => {
      active = false;
    };
  }, [info, project.staffing?.roleRequested, setError]);

  if (!mode || !info) return null;

  const current = project.assignments
    .filter((a) => a.role === info.role)
    .map((a) => a.userId);
  const exclude =
    mode.kind === "pm" || mode.kind === "finance"
      ? current
      : [...current, ...picked.map((p) => p.userId)];

  function confirm() {
    if (!mode) return;
    const first = picked[0];
    if (!first?.userId) {
      setError("Pilih orang terlebih dahulu.");
      return;
    }
    const code = project.code;
    switch (mode.kind) {
      case "pm":
        return run(() => assignPmAction(code, first.userId), onClose);
      case "finance":
        return run(() => assignFinancePocAction(code, first.userId), onClose);
      case "developer-replace":
        return run(
          () =>
            replaceDeveloperAction(
              code,
              mode.previousUserId,
              first.userId,
              first.techRole,
            ),
          onClose,
        );
      case "developer-add":
        return run(
          () =>
            assignDevelopersAction(
              code,
              picked
                .filter((p) => p.userId)
                .map(({ userId, techRole }) => ({ userId, techRole })),
            ),
          onClose,
        );
    }
  }

  const title =
    mode.kind === "finance" && current.length > 0
      ? "Ganti Finance POC"
      : mode.kind === "developer-add" &&
          project.assignments.some((a) => a.role === "DEVELOPER")
        ? "Tambah Developer"
        : info.title;

  return (
    <Dialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={title}
      className="w-[min(100%-2rem,36rem)]"
    >
      <div className="space-y-4">
        <ErrorText error={error} />
        <div className="grid grid-cols-2 gap-3 rounded-lg bg-surface p-3 text-xs">
          <div>
            <p className="text-[10px] text-subtle uppercase tracking-wider">
              Project
            </p>
            <p className="font-semibold text-ink">{project.name}</p>
            <p className="font-mono text-[10px] text-subtle">{project.code}</p>
          </div>
          <div>
            <p className="text-[10px] text-subtle uppercase tracking-wider">
              Peran
            </p>
            <p className="font-semibold text-ink">{info.peran}</p>
            {mode.kind === "developer-replace" ? (
              <p className="text-[11px] text-subtle">
                Menggantikan {mode.previousName}
              </p>
            ) : null}
          </div>
        </div>

        {candidates === null ? (
          <p className="text-subtle text-xs">Memuat daftar anggota…</p>
        ) : (
          picked.map((entry, index) => (
            <div
              key={entry.key}
              className="space-y-2 rounded-lg border border-line p-3"
            >
              <div className="flex items-start gap-2">
                <div className="flex-1">
                  <PersonPicker
                    label={
                      isDeveloper
                        ? `Developer ${picked.length > 1 ? index + 1 : ""}`
                        : info.peran
                    }
                    placeholder="Cari anggota aktif…"
                    candidates={candidates}
                    value={entry.userId}
                    exclude={exclude.filter((id) => id !== entry.userId)}
                    onChange={(userId) =>
                      setPicked((list) =>
                        list.map((p, i) =>
                          i === index ? { ...p, userId } : p,
                        ),
                      )
                    }
                  />
                </div>
                {picked.length > 1 ? (
                  <button
                    type="button"
                    aria-label="Hapus baris"
                    onClick={() =>
                      setPicked((list) => list.filter((_, i) => i !== index))
                    }
                    className="mt-6 rounded p-1 text-subtle hover:text-danger-text"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
              {isDeveloper ? (
                <TextField
                  label="Role teknis"
                  value={entry.techRole}
                  placeholder="contoh: Full-stack Developer"
                  onChange={(e) => {
                    const techRole = e.target.value;
                    setPicked((list) =>
                      list.map((p, i) =>
                        i === index ? { ...p, techRole } : p,
                      ),
                    );
                  }}
                />
              ) : null}
            </div>
          ))
        )}

        {mode.kind === "developer-add" ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              setPicked((list) => [
                ...list,
                {
                  key: nextKey.current++,
                  userId: "",
                  techRole: list[0]?.techRole ?? "",
                },
              ])
            }
          >
            <Plus className="size-3.5" />
            Tambah orang
          </Button>
        ) : null}

        <p className="flex items-start gap-1.5 rounded-lg bg-plum-50 px-3 py-2 text-plum-600 text-xs">
          <Info className="mt-0.5 size-3.5 shrink-0" />
          {info.access}
        </p>

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={confirm} disabled={pending || candidates === null}>
            {pending ? "Menyimpan…" : "Konfirmasi"}
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
