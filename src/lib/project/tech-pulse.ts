import {
  developersOf,
  type ProjectSnapshot,
  type TechInfoSnapshot,
} from "@/lib/project/snapshot";

export const TECH_PULSE_STALE_DAYS = 7;

export type TechPulseStatus = "NOT_STARTED" | "ON_TRACK" | "STALE" | "BLOCKED";

export interface TechPulse {
  status: TechPulseStatus;
  label: string;
  detail: string;
  lastActivityAt: Date | null;
  openBlockers: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function lastTechActivity(project: ProjectSnapshot): Date | null {
  const times: Date[] = [];
  const tech = project.techInfo;
  if (tech?.updatedAt) times.push(tech.updatedAt);
  if (tech?.latestUpdateAt) times.push(tech.latestUpdateAt);
  for (const blocker of project.blockers) {
    times.push(blocker.createdAt);
    if (blocker.resolvedAt) times.push(blocker.resolvedAt);
  }
  if (times.length === 0) return null;
  return new Date(Math.max(...times.map((time) => time.getTime())));
}

function hasTechTrace(tech: TechInfoSnapshot | null): boolean {
  if (!tech) return false;
  return Boolean(
    tech.githubRepo ||
      tech.sprintPlanning ||
      tech.currentSprint ||
      tech.nextMilestone ||
      tech.latestUpdate ||
      tech.progressPercent !== null,
  );
}

/**
 * Jejak pengembangan yang dihitung dari data yang sudah ada: blocker, tautan
 * GitHub, progres, dan waktu baris tech_infos berubah. Bukan isian status
 * terpisah.
 */
export function techPulse(project: ProjectSnapshot, now: Date): TechPulse {
  const openBlockers = project.blockers.filter(
    (blocker) => !blocker.resolvedAt,
  ).length;
  const lastActivityAt = lastTechActivity(project);
  const assigned = developersOf(project).length > 0;

  if (openBlockers > 0) {
    return {
      status: "BLOCKED",
      label: "Ada blocker",
      detail: `${openBlockers} blocker terbuka. Status ini dihitung otomatis dari daftar blocker.`,
      lastActivityAt,
      openBlockers,
    };
  }

  if (!assigned && !hasTechTrace(project.techInfo)) {
    return {
      status: "NOT_STARTED",
      label: "Belum dimulai",
      detail: "Developer belum ditugaskan dan belum ada jejak pengembangan.",
      lastActivityAt: null,
      openBlockers: 0,
    };
  }

  if (!lastActivityAt && !hasTechTrace(project.techInfo)) {
    return {
      status: "NOT_STARTED",
      label: "Belum ada jejak",
      detail:
        "Belum ada progres, tautan GitHub, atau blocker. Isi salah satunya di Stage 6.",
      lastActivityAt: null,
      openBlockers: 0,
    };
  }

  const stamp = lastActivityAt ?? now;
  const days = Math.max(
    0,
    Math.floor((now.getTime() - stamp.getTime()) / DAY_MS),
  );
  if (days >= TECH_PULSE_STALE_DAYS) {
    return {
      status: "STALE",
      label: "Update tertinggal",
      detail: `Jejak terakhir ${days} hari lalu. Ambang ${TECH_PULSE_STALE_DAYS} hari, dihitung dari progres, GitHub, atau blocker.`,
      lastActivityAt,
      openBlockers: 0,
    };
  }

  return {
    status: "ON_TRACK",
    label: "Ada jejak baru",
    detail:
      days === 0
        ? "Ada perubahan pengembangan hari ini."
        : `Jejak terakhir ${days} hari lalu.`,
    lastActivityAt,
    openBlockers: 0,
  };
}
