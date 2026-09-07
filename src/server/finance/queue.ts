import { checkPermission } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import type { FinanceQueueItem } from "@/lib/finance/queue";
import { composeFinanceQueueItem } from "@/lib/finance/queue";
import type { WorkingHoursConfig } from "@/lib/sla/working-hours";
import { DEFAULT_WORKING_HOURS } from "@/lib/sla/working-hours";
import { prisma } from "@/server/db";

export type Refusal = { ok: false; reason: string };

function refuse(reason: string): Refusal {
  return { ok: false, reason };
}

export type { FinanceQueueItem };

/**
 * Antrean invoice dan kuitansi yang masih menunggu, lintas project (F15-T01).
 *
 * Izin `finance.view` diperiksa di sini, bukan hanya disembunyikan di tampilan,
 * supaya permintaan langsung ke server tetap ditolak (F03-AC2). PM, Finance
 * POC, dan CFO memegang izin itu secara global, jadi antrean yang sama bisa
 * dibaca keduanya — itulah F15-AC2.
 *
 * Yang dikembalikan hanya dokumen yang masih menunggu keputusan, pembayaran,
 * atau verifikasi. Ditolak dan lunas disaring di kueri, lalu disaring sekali
 * lagi oleh `composeFinanceQueueItem` supaya aturan keanggotaannya tidak
 * pecah dua.
 *
 * Ini bukan `readFinanceChain`. Rantai itu melihat satu project secara utuh;
 * antrean ini melihat lintas project dan diurutkan dari yang tertahan paling lama.
 */
export async function readFinanceQueue(
  actor: Actor,
  now: Date = new Date(),
  workingHours: WorkingHoursConfig = DEFAULT_WORKING_HOURS,
): Promise<{ ok: true; items: FinanceQueueItem[] } | Refusal> {
  const izin = checkPermission({ actor, action: "finance.view", now });
  if (!izin.allowed) return refuse(izin.reason);

  const rows = await prisma.invoice.findMany({
    where: {
      submission: { status: { not: "REJECTED" } },
      NOT: { receipt: { is: { status: "VALID" } } },
    },
    orderBy: { issuedAt: "asc" },
    select: {
      id: true,
      number: true,
      clientName: true,
      amount: true,
      dueDate: true,
      issuedAt: true,
      project: { select: { projectId: true } },
      submission: {
        select: {
          status: true,
          currentStepOrder: true,
          revision: true,
          steps: { select: { order: true, label: true, revision: true } },
        },
      },
      receipt: { select: { status: true } },
    },
  });

  const items: FinanceQueueItem[] = [];
  for (const row of rows) {
    const currentStepLabel =
      row.submission.steps.find(
        (step) =>
          step.revision === row.submission.revision &&
          step.order === row.submission.currentStepOrder,
      )?.label ?? null;

    const item = composeFinanceQueueItem(
      {
        invoiceId: row.id,
        documentNumber: row.number,
        projectId: row.project.projectId,
        clientName: row.clientName,
        amount: row.amount.toString(),
        dueDate: row.dueDate,
        invoiceStatus: row.submission.status,
        receiptStatus: row.receipt?.status ?? null,
        currentStepLabel,
        issuedAt: row.issuedAt,
      },
      now,
      workingHours,
    );
    if (item) items.push(item);
  }

  return { ok: true, items };
}

/** Izin melihat antrean, dipakai pemanggil sebelum menampilkannya. */
export function canReadFinanceQueue(actor: Actor, now: Date): boolean {
  return checkPermission({ actor, action: "finance.view", now }).allowed;
}
