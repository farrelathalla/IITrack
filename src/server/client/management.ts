import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { checkPermission } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import {
  type ClientDraft,
  clientDraftsEqual,
  type NormalizedClient,
  normalizeClientDraft,
} from "@/lib/client/profile";
import { recordAudit } from "@/server/audit";
import { prisma } from "@/server/db";

export type Refusal = { ok: false; reason: string };

function refuse(reason: string): Refusal {
  return { ok: false, reason };
}

function potretDariBaris(row: {
  name: string;
  contact: string | null;
  address: string | null;
  npwp: string | null;
}): NormalizedClient {
  return {
    name: row.name,
    contact: row.contact,
    address: row.address,
    npwp: row.npwp,
  };
}

async function namaSudahDipakai(
  name: string,
  besidesId?: string,
): Promise<boolean> {
  const bentrok = await prisma.client.findFirst({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(besidesId ? { NOT: { id: besidesId } } : {}),
    },
    select: { id: true },
  });
  return bentrok !== null;
}

export interface CreateClientInput {
  actor: Actor;
  draft: ClientDraft;
  now?: Date;
}

/**
 * Menyimpan client baru sebagai master data.
 *
 * Yang boleh menulis adalah jabatan dengan `client.manage` (COO / Officer
 * Operational). PM hanya memilih dari daftar ini saat mendaftarkan project.
 */
export async function createClient(
  input: CreateClientInput,
): Promise<{ ok: true; clientId: string } | Refusal> {
  const now = input.now ?? new Date();
  const izin = checkPermission({
    actor: input.actor,
    action: "client.manage",
    now,
  });
  if (!izin.allowed) return refuse(izin.reason);

  const penilaian = normalizeClientDraft(input.draft);
  if (!penilaian.valid) return refuse(penilaian.reason);

  if (await namaSudahDipakai(penilaian.value.name)) {
    return refuse(
      `Client bernama ${penilaian.value.name} sudah ada. Pilih yang sudah tersimpan, jangan ketik ulang.`,
    );
  }

  const created = await prisma.client.create({
    data: {
      name: penilaian.value.name,
      contact: penilaian.value.contact,
      address: penilaian.value.address,
      npwp: penilaian.value.npwp,
      revision: 1,
      revisions: {
        create: {
          revision: 1,
          name: penilaian.value.name,
          contact: penilaian.value.contact,
          address: penilaian.value.address,
          npwp: penilaian.value.npwp,
          changedById: input.actor.userId,
        },
      },
    },
    select: { id: true },
  });

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.CLIENT_CREATED,
    objectType: AUDIT_OBJECTS.CLIENT,
    objectId: created.id,
    after: penilaian.value,
  });

  return { ok: true, clientId: created.id };
}

export interface UpdateClientInput {
  actor: Actor;
  clientId: string;
  draft: ClientDraft;
  now?: Date;
}

/**
 * Mengubah data client yang sedang berlaku, tanpa menghapus potret lama.
 *
 * Revisi baru ditambah; baris revisi lama tidak disentuh. Nama yang tampil
 * pada seluruh project yang merujuk client ini ikut diganti, sesuai F06-AC2.
 */
export async function updateClient(
  input: UpdateClientInput,
): Promise<{ ok: true; revision: number } | Refusal> {
  const now = input.now ?? new Date();
  const izin = checkPermission({
    actor: input.actor,
    action: "client.manage",
    now,
  });
  if (!izin.allowed) return refuse(izin.reason);

  const penilaian = normalizeClientDraft(input.draft);
  if (!penilaian.valid) return refuse(penilaian.reason);

  const existing = await prisma.client.findUnique({
    where: { id: input.clientId },
    select: {
      id: true,
      name: true,
      contact: true,
      address: true,
      npwp: true,
      revision: true,
    },
  });
  if (!existing) return refuse("Client yang dimaksud tidak ditemukan.");

  const lama = potretDariBaris(existing);
  if (clientDraftsEqual(lama, penilaian.value)) {
    return refuse("Tidak ada perubahan yang disimpan.");
  }

  if (await namaSudahDipakai(penilaian.value.name, existing.id)) {
    return refuse(
      `Nama ${penilaian.value.name} sudah dipakai client lain, jadi tidak bisa dipakai ulang.`,
    );
  }

  const revision = existing.revision + 1;

  await prisma.$transaction([
    prisma.client.update({
      where: { id: existing.id },
      data: {
        name: penilaian.value.name,
        contact: penilaian.value.contact,
        address: penilaian.value.address,
        npwp: penilaian.value.npwp,
        revision,
      },
    }),
    prisma.clientRevision.create({
      data: {
        clientId: existing.id,
        revision,
        name: penilaian.value.name,
        contact: penilaian.value.contact,
        address: penilaian.value.address,
        npwp: penilaian.value.npwp,
        changedById: input.actor.userId,
      },
    }),
    prisma.project.updateMany({
      where: { clientId: existing.id },
      data: { clientName: penilaian.value.name },
    }),
  ]);

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.CLIENT_UPDATED,
    objectType: AUDIT_OBJECTS.CLIENT,
    objectId: existing.id,
    before: lama,
    after: penilaian.value,
  });

  return { ok: true, revision };
}

/**
 * Daftar client yang bisa dipilih saat mendaftarkan project.
 *
 * Membaca master data tidak membutuhkan `client.manage`; cukup melihat.
 */
export async function listClients(
  actor: Actor,
  now: Date = new Date(),
): Promise<
  { ok: true; clients: Array<NormalizedClient & { id: string }> } | Refusal
> {
  const izin = checkPermission({
    actor,
    action: "master_data.view",
    now,
  });
  if (!izin.allowed) return refuse(izin.reason);

  const rows = await prisma.client.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      contact: true,
      address: true,
      npwp: true,
    },
  });

  return {
    ok: true,
    clients: rows.map((row) => ({
      id: row.id,
      ...potretDariBaris(row),
    })),
  };
}
