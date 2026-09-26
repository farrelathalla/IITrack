import type { Division } from "@/lib/auth/types";
import { stageDefinition } from "./catalog";

/**
 * Angka grafik dashboard, dihitung dari project yang sudah tersimpan.
 * Tidak ada status "ditahan": kolom itu tidak ada di skema.
 * Project selesai dihitung pada divisi stage-nya saat ini. Project yang
 * sudah ditutup berada di stage 9, yaitu Project Management.
 */

export interface ChartProject {
  closedAt: Date | null;
  createdAt: Date;
  stageNumber: number;
  stageStatus: string;
}

export interface DivisionBar {
  label: string;
  active: number;
  completed: number;
}

export interface StatusSlice {
  key: "active" | "completed" | "not-started";
  label: string;
  value: number;
  color: string;
}

const DIVISIONS: { division: Exclude<Division, "SYSTEM">; label: string }[] = [
  { division: "TECHDEV", label: "Tech Development" },
  { division: "FINANCE", label: "Finance" },
  { division: "OPERATIONAL", label: "Project Management" },
];

export function isNotStarted(project: ChartProject): boolean {
  return (
    project.closedAt == null &&
    project.stageNumber === 1 &&
    project.stageStatus === "not-started"
  );
}

export function divisionBars(projects: readonly ChartProject[]): DivisionBar[] {
  return DIVISIONS.map(({ division, label }) => {
    const rows = projects.filter(
      (project) => stageDefinition(project.stageNumber).division === division,
    );
    return {
      label,
      active: rows.filter((project) => project.closedAt == null).length,
      completed: rows.filter((project) => project.closedAt != null).length,
    };
  });
}

export function statusSlices(projects: readonly ChartProject[]): StatusSlice[] {
  const notStarted = projects.filter(isNotStarted).length;
  const completed = projects.filter(
    (project) => project.closedAt != null,
  ).length;
  const active = projects.length - notStarted - completed;
  return [
    { key: "active", label: "Berjalan", value: active, color: "#5b3f9a" },
    { key: "completed", label: "Selesai", value: completed, color: "#1a7048" },
    {
      key: "not-started",
      label: "Belum dimulai",
      value: notStarted,
      color: "#b7b7c2",
    },
  ];
}

/** Jumlah pada suatu saat, dari cap waktu yang tersimpan. */
export function stockAt(
  projects: readonly ChartProject[],
  at: Date,
  kind: "all" | "active" | "completed",
): number {
  if (kind === "all") {
    return projects.filter((project) => project.createdAt < at).length;
  }
  if (kind === "completed") {
    return projects.filter(
      (project) => project.closedAt != null && project.closedAt < at,
    ).length;
  }
  return projects.filter(
    (project) =>
      project.createdAt < at &&
      (project.closedAt == null || project.closedAt >= at),
  ).length;
}

export function sinceMonthStart(nowCount: number, thenCount: number): string {
  const delta = nowCount - thenCount;
  if (delta === 0) return "sama dengan awal bulan";
  const mark = delta > 0 ? "+" : "−";
  return `${mark}${Math.abs(delta)} dari awal bulan`;
}
