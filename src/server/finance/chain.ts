import { checkPermission } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import type { ChainSnapshot, TerminChainState } from "@/lib/finance/chain";
import { chainInconsistencies, deriveTerminState } from "@/lib/finance/chain";
import { compareReceiptAmount } from "@/lib/finance/receipt";
import { prisma } from "@/server/db";

export type Refusal = { ok: false; reason: string };

function refuse(reason: string): Refusal {
  return { ok: false, reason };
}

export interface ChainInvoice {
  id: string;
  number: string;
  amount: string;
  submissionId: string;
  submissionStatus: "PENDING" | "APPROVED" | "REJECTED";
  /** Langkah yang sedang menunggu keputusan, kosong bila rantainya selesai. */
  currentStepLabel: string | null;
  issuedAt: Date;
}

export interface ChainReceipt {
  id: string;
  number: string;
  amount: string;
  status: "RECORDED" | "VALID";
  proofUrl: string;
  resolution: string | null;
  /** Peringatan selisih terhadap invoice, kosong bila nilainya sama. */
  warning: string | null;
}

export interface TerminChainRow {
  terminId: string;
  sequence: number;
  percentage: string;
  amount: string;
  dueDate: Date;
  terminStatus: "UNPAID" | "PAID";
  state: TerminChainState;
  /** Invoice terakhir untuk termin ini. */
  invoice: ChainInvoice | null;
  /** Kuitansi pada invoice terakhir itu. */
  receipt: ChainReceipt | null;
  /** Invoice lama yang sudah ditolak, terbaru lebih dulu. */
  superseded: ChainInvoice[];
}

export interface FinanceChain {
  projectId: string;
  projectName: string;
  clientName: string;
  projectValue: string | null;
  termins: TerminChainRow[];
  /** Pertentangan keadaan yang ditemukan, kosong bila datanya konsisten. */
  inconsistencies: string[];
}

/**
 * Keadaan seluruh rantai Finance sebuah project dalam satu permintaan (XC-03).
 *
 * Titik integrasi lima bagian yang selama ini berdiri sendiri: jadwal termin,
 * invoice, rantai persetujuan, bukti transfer, dan kuitansi. Dibaca sekaligus
 * karena keadaan satu termin baru berarti bila kelimanya dilihat bersama —
 * "invoice sudah disetujui tetapi kuitansinya belum diverifikasi" tidak bisa
 * dijawab oleh satu tabel mana pun sendirian.
 *
 * Ini bukan antrean Finance (F15). Antrean melihat lintas project dan diurutkan
 * berdasarkan lama menunggu; yang ini melihat satu project secara utuh.
 */
export async function readFinanceChain(
  actor: Actor,
  projectDbId: string,
  now: Date = new Date(),
): Promise<{ ok: true; chain: FinanceChain } | Refusal> {
  const izin = checkPermission({ actor, action: "finance.view", now });
  if (!izin.allowed) return refuse(izin.reason);

  const project = await prisma.project.findUnique({
    where: { id: projectDbId },
    select: {
      projectId: true,
      name: true,
      clientName: true,
      value: true,
      termins: {
        orderBy: { sequence: "asc" },
        select: {
          id: true,
          sequence: true,
          percentage: true,
          amount: true,
          dueDate: true,
          status: true,
          invoices: {
            orderBy: { issuedAt: "desc" },
            select: {
              id: true,
              number: true,
              amount: true,
              issuedAt: true,
              submission: {
                select: {
                  id: true,
                  status: true,
                  currentStepOrder: true,
                  revision: true,
                  steps: {
                    select: { order: true, label: true, revision: true },
                  },
                },
              },
              receipt: {
                select: {
                  id: true,
                  number: true,
                  amount: true,
                  status: true,
                  proofUrl: true,
                  resolution: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!project) return refuse("Project yang dimaksud tidak ditemukan.");

  type InvoiceRow = (typeof project.termins)[number]["invoices"][number];

  const bentukInvoice = (row: InvoiceRow): ChainInvoice => ({
    id: row.id,
    number: row.number,
    amount: row.amount.toString(),
    submissionId: row.submission.id,
    submissionStatus: row.submission.status,
    currentStepLabel:
      row.submission.steps.find(
        (step) =>
          step.revision === row.submission.revision &&
          step.order === row.submission.currentStepOrder,
      )?.label ?? null,
    issuedAt: row.issuedAt,
  });

  const seluruhMasalah: string[] = [];

  const termins = project.termins.map((termin) => {
    const [terbaru, ...lama] = termin.invoices;

    const invoice = terbaru ? bentukInvoice(terbaru) : null;
    const receiptRow = terbaru?.receipt ?? null;

    const receipt: ChainReceipt | null = receiptRow
      ? {
          id: receiptRow.id,
          number: receiptRow.number,
          amount: receiptRow.amount.toString(),
          status: receiptRow.status,
          proofUrl: receiptRow.proofUrl,
          resolution: receiptRow.resolution,
          warning: (() => {
            const perbandingan = compareReceiptAmount(
              terbaru.amount.toString(),
              receiptRow.amount.toString(),
            );
            return perbandingan.readable ? perbandingan.warning : null;
          })(),
        }
      : null;

    const snapshot: ChainSnapshot = {
      terminStatus: termin.status,
      invoiceStatus: invoice?.submissionStatus ?? null,
      receiptStatus: receipt?.status ?? null,
    };

    for (const masalah of chainInconsistencies(snapshot)) {
      seluruhMasalah.push(`Termin ${termin.sequence}: ${masalah}`);
    }

    return {
      terminId: termin.id,
      sequence: termin.sequence,
      percentage: termin.percentage.toString(),
      amount: termin.amount.toString(),
      dueDate: termin.dueDate,
      terminStatus: termin.status,
      state: deriveTerminState(snapshot),
      invoice,
      receipt,
      superseded: lama.map(bentukInvoice),
    };
  });

  return {
    ok: true,
    chain: {
      projectId: project.projectId,
      projectName: project.name,
      clientName: project.clientName,
      projectValue: project.value?.toString() ?? null,
      termins,
      inconsistencies: seluruhMasalah,
    },
  };
}
