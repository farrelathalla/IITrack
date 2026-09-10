import type { AuditAction, AuditObjectType } from "@/lib/audit/actions";
import { prisma } from "@/server/db";

export interface AuditEntry {
  /** Kosong bila pelakunya belum teridentifikasi. */
  actorId: string | null;
  action: AuditAction;
  objectType: AuditObjectType;
  objectId?: string | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ipAddress?: string | null;
}

/**
 * Satu-satunya pintu penulisan jejak aktivitas. Seluruh aksi kritis memanggil
 * fungsi ini, sehingga pencatatan tidak bergantung pada ingatan penulis kode di
 * masing-masing fitur (Project Charter, kelompok Jejak Aktivitas).
 *
 * Kegagalan penulisan sengaja tidak ditelan. Definition of Done mewajibkan aksi
 * kritis meninggalkan jejak, jadi aksi yang jejaknya gagal ditulis lebih baik
 * ikut gagal daripada berhasil diam-diam tanpa catatan.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  await prisma.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      objectType: entry.objectType,
      objectId: entry.objectId ?? null,
      before:
        entry.before === undefined
          ? undefined
          : JSON.parse(JSON.stringify(entry.before)),
      after:
        entry.after === undefined
          ? undefined
          : JSON.parse(JSON.stringify(entry.after)),
      reason: entry.reason ?? null,
      ipAddress: entry.ipAddress ?? null,
    },
  });
}
