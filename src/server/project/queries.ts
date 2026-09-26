import {
  type MyProjectRole,
  myProjectRole,
  seesAllProjects,
  type Viewer,
} from "@/lib/auth/access";
import type { ProjectSnapshot } from "@/lib/project/snapshot";
import { deriveStages, type StageState } from "@/lib/project/stages";
import {
  type DeadlineItem,
  isAwaitingUser,
  openDeadlines,
  type ProjectSummary,
  summarize,
} from "@/lib/project/status";
import { prisma } from "@/server/db";
import { accessOf, SNAPSHOT_INCLUDE, snapshotsFrom } from "./snapshot";

export interface ProjectListItem {
  project: ProjectSnapshot;
  stages: StageState[];
  summary: ProjectSummary;
  deadlines: DeadlineItem[];
  myRole: MyProjectRole | null;
  awaitingMe: boolean;
}

/**
 * Project yang relevan untuk pengguna: C-Level (dan Super Admin) melihat
 * semua, jabatan lain hanya project tempat ia ditugaskan (PRD bab 8.1-8.2).
 */
export async function listProjects(
  viewer: Viewer,
  options: { closed: boolean; now?: Date },
): Promise<ProjectListItem[]> {
  const now = options.now ?? new Date();
  const rows = await prisma.project.findMany({
    where: {
      closedAt: options.closed ? { not: null } : null,
      ...(seesAllProjects(viewer.role)
        ? {}
        : {
            assignments: {
              some: { userId: viewer.userId, endedAt: null },
            },
          }),
    },
    include: SNAPSHOT_INCLUDE,
    orderBy: options.closed ? { closedAt: "desc" } : { createdAt: "desc" },
  });

  const snapshots = await snapshotsFrom(rows);
  return snapshots.map((project) => {
    const stages = deriveStages(project, now);
    const summary = summarize(project, stages, now);
    return {
      project,
      stages,
      summary,
      deadlines: openDeadlines(project, stages),
      myRole: myProjectRole(viewer, accessOf(project)),
      awaitingMe: isAwaitingUser(
        summary.nextAction,
        viewer.userId,
        viewer.role,
      ),
    };
  });
}

/** Riwayat project yang pernah ditangani, termasuk penugasan yang sudah berakhir. */
export async function listPastProjects(
  viewer: Viewer,
  now: Date = new Date(),
): Promise<ProjectListItem[]> {
  if (seesAllProjects(viewer.role)) {
    return listProjects(viewer, { closed: true, now });
  }
  const rows = await prisma.project.findMany({
    where: {
      closedAt: { not: null },
      assignments: { some: { userId: viewer.userId } },
    },
    include: SNAPSHOT_INCLUDE,
    orderBy: { closedAt: "desc" },
  });
  const pastRoles = await prisma.projectAssignment.findMany({
    where: { userId: viewer.userId, projectId: { in: rows.map((r) => r.id) } },
    orderBy: { startedAt: "desc" },
    select: { projectId: true, role: true },
  });
  const roleByProject = new Map<string, MyProjectRole>();
  for (const row of pastRoles) {
    if (!roleByProject.has(row.projectId))
      roleByProject.set(row.projectId, row.role);
  }

  const snapshots = await snapshotsFrom(rows);
  return snapshots.map((project) => {
    const stages = deriveStages(project, now);
    return {
      project,
      stages,
      summary: summarize(project, stages, now),
      deadlines: [],
      myRole: roleByProject.get(project.id) ?? null,
      awaitingMe: false,
    };
  });
}

export interface CountSummary {
  all: number;
  active: number;
  completedThisYear: number;
}

export async function projectCounts(yearStart: Date): Promise<CountSummary> {
  const [all, active, completedThisYear] = await Promise.all([
    prisma.project.count(),
    prisma.project.count({ where: { closedAt: null } }),
    prisma.project.count({ where: { closedAt: { gte: yearStart } } }),
  ]);
  return { all, active, completedThisYear };
}

export interface ActivityItem {
  id: string;
  actorName: string;
  summary: string;
  result: string;
  feedback: string | null;
  stage: number | null;
  division: string | null;
  createdAt: Date;
  projectName: string | null;
  projectCode: string | null;
}

export async function projectActivity(
  projectId: string,
): Promise<ActivityItem[]> {
  const rows = await prisma.activityLog.findMany({
    where: { projectId },
    orderBy: { createdAt: "desc" },
    include: { actor: { select: { name: true } } },
  });
  return rows.map((row) => ({
    id: row.id,
    actorName: row.actor?.name ?? "Sistem",
    summary: row.summary,
    result: row.result,
    feedback: row.feedback,
    stage: row.stage,
    division: row.division,
    createdAt: row.createdAt,
    projectName: null,
    projectCode: null,
  }));
}

/** Aktivitas terbaru dari project yang terlihat oleh pengguna. */
export async function recentActivity(
  projectIds: string[] | "all",
  take = 8,
): Promise<ActivityItem[]> {
  const rows = await prisma.activityLog.findMany({
    where:
      projectIds === "all"
        ? { projectId: { not: null } }
        : { projectId: { in: projectIds } },
    orderBy: { createdAt: "desc" },
    take,
    include: {
      actor: { select: { name: true } },
      project: { select: { name: true, code: true } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    actorName: row.actor?.name ?? "Sistem",
    summary: row.summary,
    result: row.result,
    feedback: row.feedback,
    stage: row.stage,
    division: row.division,
    createdAt: row.createdAt,
    projectName: row.project?.name ?? null,
    projectCode: row.project?.code ?? null,
  }));
}

/**
 * Pencarian top bar: Project ID, nama project, atau nama client. Semua akun
 * aktif boleh membuka Project Detail project mana pun (PRD bab 2.4).
 */
export async function searchProjects(query: string) {
  const q = query.trim();
  if (!q) return [];
  return prisma.project.findMany({
    where: {
      OR: [
        { code: { contains: q, mode: "insensitive" } },
        { name: { contains: q, mode: "insensitive" } },
        { client: { contains: q, mode: "insensitive" } },
      ],
    },
    select: { code: true, name: true, client: true, closedAt: true },
    orderBy: { createdAt: "desc" },
    take: 8,
  });
}
