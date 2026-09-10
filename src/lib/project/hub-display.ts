import { can } from "@/lib/auth/permissions";
import type { Action, Actor } from "@/lib/auth/types";
import { findStage, STAGE_CATALOGUE } from "@/lib/project/stages";
import {
  PROJECT_LIST_COLUMNS,
  type ProjectListColumn,
} from "@/lib/ui/project-hub-layout";

/**
 * Pemformatan tampilan F08 (murni). Dipakai daftar + hub; diuji tanpa DB.
 */

export function formatProjectValue(
  value: { toString(): string } | number | string | null | undefined,
): string | null {
  if (value === null || value === undefined || value === "") return null;
  const amount =
    typeof value === "number" ? value : Number.parseFloat(value.toString());
  if (!Number.isFinite(amount)) return null;
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDateTimeId(value: Date | null | undefined): string {
  if (!value) return "—";
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(value);
}

export function stageLabel(stageKey: string | null | undefined): string {
  if (!stageKey) return "Belum ditetapkan";
  return findStage(STAGE_CATALOGUE, stageKey)?.label ?? stageKey;
}

export { summarizeAuditAction } from "@/lib/audit/activity";

export function visibleProjectListColumns(
  actor: Actor,
  now: Date = new Date(),
): ProjectListColumn[] {
  // `project.view_value` bersifat project-scoped di mesin izin. Untuk kolom
  // daftar kita memakai konteks kosong: hanya jabatan yang punya hak global
  // (mis. COO/CFO) yang melihat nilai lintas baris.
  const listProject = {
    projectId: "*",
    assignedDivisions: [] as import("@/lib/auth/types").Division[],
  };

  return PROJECT_LIST_COLUMNS.filter((column) => {
    if (!column.requires) return true;
    return can({
      actor,
      action: column.requires as Action,
      project: listProject,
      now,
    });
  });
}
