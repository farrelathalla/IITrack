"use client";

import { X } from "lucide-react";
import { useEffect } from "react";
import { Badge, type Tone } from "@/components/ui/badge";
import { DIVISION_LABELS } from "@/lib/auth/roles";
import type { Division } from "@/lib/auth/types";
import { formatDateTime } from "@/lib/time";
import type { ActivityItem } from "@/server/project/queries";

const RESULT: Record<string, { label: string; tone: Tone }> = {
  CREATED: { label: "Dibuat", tone: "brand" },
  UPDATED: { label: "Diperbarui", tone: "neutral" },
  SUBMITTED: { label: "Diajukan", tone: "warning" },
  APPROVED: { label: "Disetujui", tone: "success" },
  REJECTED: { label: "Ditolak", tone: "danger" },
};

/**
 * Riwayat Aktivitas: drawer kanan berisi timeline waktu, pelaku, aksi, stage
 * atau divisi, dan hasil. Tidak bisa diubah atau dihapus (PRD bab 8.3).
 */
export function ActivityDrawer({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: ActivityItem[];
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <button
        type="button"
        aria-label="Tutup riwayat"
        onClick={onClose}
        className="fade-in flex-1 bg-ink/30"
      />
      <aside
        role="dialog"
        aria-label="Riwayat Aktivitas"
        className="drawer-in flex h-full w-[440px] flex-col bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-line border-b px-5 py-4">
          <div>
            <h2 className="font-bold text-ink">Riwayat Aktivitas</h2>
            <p className="text-subtle text-xs">
              Tidak bisa diubah atau dihapus.
            </p>
          </div>
          <button
            type="button"
            aria-label="Tutup"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted hover:bg-surface"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {items.length === 0 ? (
            <p className="py-10 text-center text-xs text-subtle">
              Belum ada aktivitas tercatat.
            </p>
          ) : (
            <ol className="relative space-y-4 border-line border-l pl-5">
              {items.map((item) => {
                const result = RESULT[item.result] ?? RESULT.UPDATED;
                const where = item.stage
                  ? `Stage ${item.stage}`
                  : item.division
                    ? (DIVISION_LABELS[item.division as Division] ??
                      item.division)
                    : null;
                return (
                  <li key={item.id} className="relative">
                    <span className="-left-[25px] absolute top-1.5 size-2.5 rounded-full border-2 border-white bg-plum-600" />
                    <p className="text-[11px] text-subtle">
                      {formatDateTime(item.createdAt)}
                    </p>
                    <p className="text-ink text-xs leading-snug">
                      <span className="font-semibold">{item.actorName}</span>{" "}
                      {item.summary}
                    </p>
                    <div className="mt-1 flex items-center gap-1.5">
                      <Badge tone={result.tone}>{result.label}</Badge>
                      {where ? (
                        <span className="text-[11px] text-subtle">{where}</span>
                      ) : null}
                    </div>
                    {item.feedback ? (
                      <p className="mt-1 rounded-md bg-surface px-2 py-1 text-muted text-xs">
                        &ldquo;{item.feedback}&rdquo;
                      </p>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}
