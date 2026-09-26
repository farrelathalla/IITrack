import type { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/server/db";

export type Tx = Prisma.TransactionClient;

export type ActivityResult =
  | "CREATED"
  | "UPDATED"
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED";

export interface ActivityEntry {
  projectId?: string | null;
  actorId: string | null;
  /** Kode mesin, misalnya "mou.submitted". */
  action: string;
  /** Kalimat yang ditampilkan, misalnya "Mengajukan MoU untuk persetujuan". */
  summary: string;
  stage?: number | null;
  division?: string | null;
  result?: ActivityResult;
  feedback?: string | null;
  objectType?: string | null;
  objectId?: string | null;
  data?: unknown;
}

/**
 * Satu-satunya pintu penulisan Riwayat Aktivitas (PRD bab 12, "Aktivitas yang
 * wajib dicatat"). Selalu dipanggil di dalam transaksi yang sama dengan
 * perubahannya, sehingga perubahan tanpa jejak tidak mungkin tersimpan.
 */
export async function recordActivity(
  tx: Tx,
  entry: ActivityEntry,
): Promise<void> {
  await tx.activityLog.create({
    data: {
      projectId: entry.projectId ?? null,
      actorId: entry.actorId,
      action: entry.action,
      summary: entry.summary,
      stage: entry.stage ?? null,
      division: entry.division ?? null,
      result: entry.result ?? "UPDATED",
      feedback: entry.feedback ?? null,
      objectType: entry.objectType ?? null,
      objectId: entry.objectId ?? null,
      data:
        entry.data === undefined
          ? undefined
          : JSON.parse(JSON.stringify(entry.data)),
    },
  });
}

export async function recordActivityNow(entry: ActivityEntry): Promise<void> {
  await recordActivity(prisma as unknown as Tx, entry);
}
