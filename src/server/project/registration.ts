import { z } from "zod";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { checkPermission } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import { parseProjectId } from "@/lib/project/project-id";
import { recordAudit } from "@/server/audit";
import { prisma } from "@/server/db";

const registration = z.object({
  name: z.string().trim().min(1, "Nama project wajib diisi."),
  clientName: z.string().trim().min(1, "Nama client wajib diisi."),
  clientId: z.string().trim().min(1).optional(),
  period: z
    .string()
    .regex(/^\d{4}$/, "Periode harus empat digit, misalnya 2627."),
  value: z
    .number()
    .positive("Nilai project harus lebih besar dari nol.")
    .nullish(),
});

export type RegisterProjectInput = z.input<typeof registration>;

export type RegisterProjectResult =
  | { registered: true; id: string; projectId: string }
  | { registered: false; reason: string; fields?: Record<string, string> };

/**
 * Mendaftarkan project dan menerbitkan Project ID-nya.
 *
 * Nomor baru diambil setelah seluruh field wajib lolos pemeriksaan, sehingga
 * pendaftaran yang datanya belum lengkap tidak menghabiskan satu nomor
 * (F05-AC2).
 */
export async function registerProject(params: {
  actor: Actor;
  input: RegisterProjectInput;
  now?: Date;
}): Promise<RegisterProjectResult> {
  const izin = checkPermission({
    actor: params.actor,
    action: "project.create",
    now: params.now ?? new Date(),
  });

  if (!izin.allowed) {
    return { registered: false, reason: izin.reason };
  }

  const parsed = registration.safeParse(params.input);

  if (!parsed.success) {
    const fields: Record<string, string> = {};
    for (const issue of parsed.error.issues) {
      const key = String(issue.path[0] ?? "form");
      if (!fields[key]) fields[key] = issue.message;
    }

    return {
      registered: false,
      reason:
        "Pendaftaran belum bisa disimpan karena ada isian yang belum lengkap. Nomor project belum diterbitkan.",
      fields,
    };
  }

  const data = parsed.data;

  let clientName = data.clientName;
  let clientId: string | null = null;

  if (data.clientId) {
    const master = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: { id: true, name: true },
    });
    if (!master) {
      return {
        registered: false,
        reason:
          "Client yang dipilih tidak ditemukan. Pilih dari daftar master data.",
        fields: { clientId: "Client tidak ditemukan." },
      };
    }
    clientId = master.id;
    clientName = master.name;
  }

  // Menaikkan penghitung dan menyimpan project dilakukan dalam satu pernyataan
  // SQL, bukan transaksi interaktif. Satu pernyataan sudah atomik dengan
  // sendirinya, hanya butuh satu perjalanan ke basis data, dan tidak menahan
  // koneksi selama aplikasi berpikir. Bila penyimpanan project gagal, kenaikan
  // penghitungnya ikut batal, sehingga nomornya tidak pernah berlubang.
  const [project] = await prisma.$queryRaw<
    Array<{ id: string; projectId: string }>
  >`
    WITH nomor AS (
      INSERT INTO project_number_counters ("period", "highestIssued", "updatedAt")
      VALUES (${data.period}, 1, now())
      ON CONFLICT ("period") DO UPDATE
        SET "highestIssued" = project_number_counters."highestIssued" + 1,
            "updatedAt" = now()
      RETURNING "highestIssued"
    )
    INSERT INTO projects (
      "id", "projectId", "period", "sequence", "name", "clientName", "clientId",
      "value", "status", "registeredById", "createdAt", "updatedAt"
    )
    SELECT
      gen_random_uuid()::text,
      'IIT-' || ${data.period} || '-' || LPAD(nomor."highestIssued"::text, 3, '0'),
      ${data.period},
      nomor."highestIssued",
      ${data.name},
      ${clientName},
      ${clientId},
      ${data.value ?? null}::decimal,
      'ACTIVE'::"ProjectStatus",
      ${params.actor.userId},
      now(),
      now()
    FROM nomor
    RETURNING "id", "projectId"
  `;

  await recordAudit({
    actorId: params.actor.userId,
    action: AUDIT_ACTIONS.PROJECT_CREATED,
    objectType: AUDIT_OBJECTS.PROJECT,
    objectId: project.id,
    after: {
      projectId: project.projectId,
      nama: data.name,
      client: clientName,
    },
  });

  return { registered: true, id: project.id, projectId: project.projectId };
}

export type OverrideProjectIdResult =
  | { overridden: true; projectId: string }
  | { overridden: false; reason: string };

/**
 * Menetapkan Project ID secara manual untuk kasus khusus.
 *
 * Hanya COO dan Vice COO yang berwenang, dan penetapannya selalu tercatat
 * beserta nilai lama dan nilai barunya (F05-AC3). Penghitung ikut dinaikkan
 * bila nomor barunya melampaui nomor tertinggi yang pernah terbit, supaya
 * penerbitan berikutnya tidak bertabrakan dengannya.
 */
export async function overrideProjectId(params: {
  actor: Actor;
  projectDbId: string;
  newProjectId: string;
  reason: string;
  now?: Date;
}): Promise<OverrideProjectIdResult> {
  const izin = checkPermission({
    actor: params.actor,
    action: "project.override_id",
    project: { projectId: params.projectDbId, assignedDivisions: [] },
    now: params.now ?? new Date(),
  });

  if (!izin.allowed) {
    return { overridden: false, reason: izin.reason };
  }

  if (params.reason.trim().length === 0) {
    return {
      overridden: false,
      reason: "Penetapan nomor manual wajib menyertakan alasannya.",
    };
  }

  const target = parseProjectId(params.newProjectId);

  if (!target) {
    return {
      overridden: false,
      reason: `Nomor ${params.newProjectId} tidak sesuai format IIT-NNNN-NNN, jadi belum bisa dipakai.`,
    };
  }

  const existing = await prisma.project.findUnique({
    where: { id: params.projectDbId },
    select: { id: true, projectId: true, period: true, sequence: true },
  });

  if (!existing) {
    return {
      overridden: false,
      reason: "Project yang dimaksud tidak ditemukan.",
    };
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.project.update({
        where: { id: existing.id },
        data: {
          projectId: params.newProjectId,
          period: target.period,
          sequence: target.sequence,
        },
      });

      await tx.$executeRaw`
        INSERT INTO project_number_counters ("period", "highestIssued", "updatedAt")
        VALUES (${target.period}, ${target.sequence}, now())
        ON CONFLICT ("period") DO UPDATE
          SET "highestIssued" = GREATEST(
                project_number_counters."highestIssued",
                ${target.sequence}
              ),
              "updatedAt" = now()
      `;
    });
  } catch {
    return {
      overridden: false,
      reason: `Nomor ${params.newProjectId} sudah dipakai project lain, jadi tidak bisa ditetapkan lagi.`,
    };
  }

  await recordAudit({
    actorId: params.actor.userId,
    action: AUDIT_ACTIONS.PROJECT_ID_OVERRIDDEN,
    objectType: AUDIT_OBJECTS.PROJECT,
    objectId: existing.id,
    before: { projectId: existing.projectId },
    after: { projectId: params.newProjectId },
    reason: params.reason,
  });

  return { overridden: true, projectId: params.newProjectId };
}
