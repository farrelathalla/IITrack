import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { checkPermission } from "@/lib/auth/permissions";
import type { Action, Actor } from "@/lib/auth/types";
import type { ReferenceKind } from "@/lib/project/external-reference";
import {
  classifyReferenceUrl,
  normalizeReferenceUrl,
  parseGithubRepo,
} from "@/lib/project/external-reference";
import { recordAudit } from "@/server/audit";
import { prisma } from "@/server/db";
import { projectContextFor } from "@/server/project/context";

export type Refusal = { ok: false; reason: string };

function refuse(reason: string): Refusal {
  return { ok: false, reason };
}

/**
 * Izin yang dibutuhkan per jenis rujukan.
 *
 * Repository adalah urusan TechDev, sedangkan berkas Drive dan Notion adalah
 * urusan Operational. Pemisahan ini mengikuti pembagian domain pada PRD bab
 * 3.2, sehingga pelaksana Finance tidak bisa menautkan repository.
 */
const REFERENCE_PERMISSION: Record<ReferenceKind, Action> = {
  GITHUB_REPO: "techdev.edit",
  GOOGLE_DRIVE: "project.edit_operational",
  NOTION: "project.edit_operational",
  OTHER: "project.edit_operational",
};

export interface AddReferenceInput {
  actor: Actor;
  projectDbId: string;
  url: string;
  label: string;
  now?: Date;
}

/**
 * Menautkan berkas atau repository di luar IITrack ke sebuah project.
 *
 * Isinya tidak disalin; yang disimpan hanya alamatnya bersama Project ID.
 */
export async function addReference(
  input: AddReferenceInput,
): Promise<{ ok: true; referenceId: string; kind: ReferenceKind } | Refusal> {
  const now = input.now ?? new Date();

  const kind = classifyReferenceUrl(input.url);
  const url = normalizeReferenceUrl(input.url);

  if (!kind || !url) {
    return refuse(
      "Alamat tautan tidak sah. Pakai alamat lengkap yang diawali https://, misalnya https://drive.google.com/...",
    );
  }

  if (kind === "GITHUB_REPO" && !parseGithubRepo(url)) {
    return refuse(
      "Alamat GitHub itu bukan alamat sebuah repository. Pakai alamat berbentuk https://github.com/pemilik/repositori.",
    );
  }

  if (input.label.trim().length === 0) {
    return refuse("Beri nama tautannya supaya mudah dikenali di Project Hub.");
  }

  const project = await prisma.project.findUnique({
    where: { id: input.projectDbId },
    select: { id: true },
  });
  if (!project) return refuse("Project yang dimaksud tidak ditemukan.");

  const konteks = await projectContextFor(input.actor, project.id, now);

  const izin = checkPermission({
    actor: input.actor,
    action: REFERENCE_PERMISSION[kind],
    project: konteks,
    now,
  });
  if (!izin.allowed) return refuse(izin.reason);

  const sudahAda = await prisma.externalReference.findFirst({
    where: { projectId: project.id, url },
    select: { id: true },
  });
  if (sudahAda) {
    return refuse("Tautan ini sudah tersimpan pada project tersebut.");
  }

  const created = await prisma.externalReference.create({
    data: {
      projectId: project.id,
      kind,
      url,
      label: input.label.trim(),
      addedById: input.actor.userId,
    },
    select: { id: true },
  });

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.REFERENCE_ADDED,
    objectType: AUDIT_OBJECTS.PROJECT,
    objectId: project.id,
    after: { jenis: kind, url, label: input.label.trim() },
  });

  return { ok: true, referenceId: created.id, kind };
}

export interface ProjectReference {
  id: string;
  kind: ReferenceKind;
  url: string;
  label: string;
  addedBy: string;
  createdAt: Date;
}

/**
 * Tautan sebuah project.
 *
 * Disaring berdasarkan Project ID di lapisan basis data, bukan di aplikasi,
 * sehingga tautan project lain tidak pernah ikut terbawa (F25-AC1).
 */
export async function readProjectReferences(
  projectDbId: string,
): Promise<ProjectReference[]> {
  const rows = await prisma.externalReference.findMany({
    where: { projectId: projectDbId },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      kind: true,
      url: true,
      label: true,
      createdAt: true,
      addedBy: { select: { name: true } },
    },
  });

  return rows.map((row) => ({
    id: row.id,
    kind: row.kind as ReferenceKind,
    url: row.url,
    label: row.label,
    addedBy: row.addedBy.name,
    createdAt: row.createdAt,
  }));
}

/** Repository project, dibuka langsung dari Project Hub (F25-AC2). */
export async function readProjectRepository(
  projectDbId: string,
): Promise<ProjectReference | null> {
  const references = await readProjectReferences(projectDbId);
  return (
    references.find((reference) => reference.kind === "GITHUB_REPO") ?? null
  );
}
