import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { checkPermission } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import { type TerminDraft, validateTerminScheme } from "@/lib/termin/scheme";
import { recordAudit } from "@/server/audit";
import { prisma } from "@/server/db";
import { projectContextFor } from "@/server/project/context";

export type Refusal = { ok: false; reason: string };

function refuse(reason: string): Refusal {
  return { ok: false, reason };
}

export interface SaveTerminSchemeInput {
  actor: Actor;
  projectDbId: string;
  drafts: readonly TerminDraft[];
  now?: Date;
}

/**
 * Menyimpan seluruh skema termin sebuah project, mengganti yang masih belum lunas.
 *
 * Skema divalidasi utuh (total 100 persen, DP 25–50) sebelum baris ditulis.
 * Penggantian per baris tidak dipakai, karena jumlah persentase hanya bermakna
 * untuk seluruh jadwal. Termin yang sudah lunas tidak dihapus — itu urusan F20.
 */
export async function saveTerminScheme(
  input: SaveTerminSchemeInput,
): Promise<{ ok: true; count: number } | Refusal> {
  const now = input.now ?? new Date();

  const project = await prisma.project.findUnique({
    where: { id: input.projectDbId },
    select: { id: true, value: true },
  });
  if (!project) return refuse("Project yang dimaksud tidak ditemukan.");

  const konteks = await projectContextFor(input.actor, project.id, now);
  const izin = checkPermission({
    actor: input.actor,
    action: "project.edit_operational",
    project: konteks,
    now,
  });
  if (!izin.allowed) return refuse(izin.reason);

  const penilaian = validateTerminScheme({
    projectValue: project.value?.toString() ?? null,
    drafts: input.drafts,
  });
  if (!penilaian.valid) return refuse(penilaian.reason);

  const existing = await prisma.termin.findMany({
    where: { projectId: project.id },
    orderBy: { sequence: "asc" },
    select: {
      sequence: true,
      percentage: true,
      amount: true,
      dueDate: true,
      status: true,
      invoices: { select: { id: true } },
    },
  });

  if (existing.some((row) => row.status === "PAID")) {
    return refuse(
      "Skema termin tidak bisa diganti karena ada termin yang sudah lunas. Perubahan setelah pelunasan mengikuti proses kuitansi, bukan penyusunan ulang jadwal.",
    );
  }

  // Penyusunan ulang menghapus seluruh baris termin, sedangkan invoice menahan
  // baris yang ditagihkannya (onDelete: Restrict). Tanpa pemeriksaan ini,
  // penghapusannya gagal di basis data dan pemanggil menerima error foreign key
  // mentah, bukan penolakan yang bisa dibaca penggunanya.
  const ditagihkan = existing
    .filter((row) => row.invoices.length > 0)
    .map((row) => row.sequence);

  if (ditagihkan.length > 0) {
    return refuse(
      `Skema termin tidak bisa disusun ulang karena termin ${ditagihkan.join(", ")} sudah pernah diajukan invoicenya. Batalkan atau selesaikan pengajuan itu lebih dulu, supaya nilai yang tertulis pada invoice tidak berbeda dengan jadwalnya.`,
    );
  }

  await prisma.$transaction([
    prisma.termin.deleteMany({ where: { projectId: project.id } }),
    ...penilaian.termins.map((termin) =>
      prisma.termin.create({
        data: {
          projectId: project.id,
          sequence: termin.sequence,
          percentage: termin.percentage,
          amount: termin.amount,
          dueDate: termin.dueDate,
          createdById: input.actor.userId,
        },
      }),
    ),
  ]);

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.TERMIN_SCHEME_SAVED,
    objectType: AUDIT_OBJECTS.PROJECT,
    objectId: project.id,
    before:
      existing.length === 0
        ? undefined
        : {
            termin: existing.map((row) => ({
              nomor: row.sequence,
              persentase: row.percentage.toString(),
              nominal: row.amount.toString(),
              jatuhTempo: row.dueDate.toISOString(),
            })),
          },
    after: {
      termin: penilaian.termins.map((row) => ({
        nomor: row.sequence,
        persentase: row.percentage,
        nominal: row.amount,
        jatuhTempo: row.dueDate.toISOString(),
      })),
    },
  });

  return { ok: true, count: penilaian.termins.length };
}
