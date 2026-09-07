import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { checkPermission } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import type {
  ExistingInvoice,
  InvoiceManualInput,
} from "@/lib/finance/invoice";
import {
  buildInvoiceDraft,
  reasonTerminCannotBeInvoiced,
} from "@/lib/finance/invoice";
import { submitForApproval } from "@/server/approval/workflow";
import { recordAudit } from "@/server/audit";
import { prisma } from "@/server/db";
import { projectContextFor } from "@/server/project/context";

export type Refusal = { ok: false; reason: string };

function refuse(reason: string): Refusal {
  return { ok: false, reason };
}

/**
 * Membaca satu termin beserta project dan invoice yang pernah dibuat untuknya.
 *
 * Diambil sekali di muka karena ketiganya dibutuhkan bersama-sama: project
 * untuk mengisi invoice, termin untuk nilainya, dan invoice lama untuk
 * memeriksa apakah termin ini masih boleh diajukan.
 */
async function readTerminForInvoice(terminId: string) {
  return prisma.termin.findUnique({
    where: { id: terminId },
    select: {
      id: true,
      sequence: true,
      percentage: true,
      amount: true,
      dueDate: true,
      status: true,
      project: {
        select: {
          id: true,
          projectId: true,
          name: true,
          clientName: true,
          invoices: {
            select: {
              termin: { select: { sequence: true } },
              submission: {
                select: {
                  status: true,
                  currentStepOrder: true,
                  revision: true,
                  steps: {
                    select: { order: true, label: true, revision: true },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
}

export interface RequestInvoiceInput extends InvoiceManualInput {
  actor: Actor;
  terminId: string;
  now?: Date;
}

export interface RequestInvoiceResult {
  ok: true;
  invoiceId: string;
  submissionId: string;
  number: string;
  amount: string;
  currentStepOrder: number;
}

/**
 * Mengajukan invoice untuk satu termin (F16-T02).
 *
 * Pengaju tidak mengetik Project ID, client, maupun nilainya: ketiganya diambil
 * dari project dan baris termin yang sudah tersimpan. Persetujuannya berjalan
 * lewat rantai F17, jadi tidak ada alur persetujuan kedua yang terpisah.
 */
export async function requestInvoice(
  input: RequestInvoiceInput,
): Promise<RequestInvoiceResult | Refusal> {
  const now = input.now ?? new Date();

  const termin = await readTerminForInvoice(input.terminId);
  if (!termin) return refuse("Termin yang dimaksud tidak ditemukan.");

  // Izin diperiksa sebelum keadaan termin diberitahukan, supaya penolakan
  // "sudah lunas" atau "masih menunggu keputusan" tidak menjadi cara membaca
  // data Finance project yang bukan tanggung jawab pemanggil. submitForApproval
  // memeriksanya sekali lagi; aturannya tetap satu, hanya dijalankan lebih awal.
  const konteks = await projectContextFor(input.actor, termin.project.id, now);
  const izin = checkPermission({
    actor: input.actor,
    action: "finance.submit",
    project: konteks,
    now,
  });
  if (!izin.allowed) return refuse(izin.reason);

  const existing: ExistingInvoice[] = termin.project.invoices.map((row) => ({
    terminSequence: row.termin.sequence,
    submissionStatus: row.submission.status,
    currentStepLabel:
      row.submission.steps.find(
        (step) =>
          step.revision === row.submission.revision &&
          step.order === row.submission.currentStepOrder,
      )?.label ?? null,
  }));

  const tertahan = reasonTerminCannotBeInvoiced(existing, termin.sequence);
  if (tertahan) return refuse(tertahan);

  const draft = buildInvoiceDraft({
    project: {
      projectId: termin.project.projectId,
      name: termin.project.name,
      clientName: termin.project.clientName,
    },
    termin: {
      sequence: termin.sequence,
      percentage: termin.percentage.toString(),
      amount: termin.amount.toString(),
      dueDate: termin.dueDate,
      status: termin.status,
    },
    manual: { description: input.description, notes: input.notes },
  });
  if (!draft.ok) return refuse(draft.reason);

  const isi = draft.draft;

  const submission = await submitForApproval({
    actor: input.actor,
    type: "INVOICE",
    projectDbId: termin.project.id,
    payload: {
      nomor: isi.number,
      terminId: termin.id,
      termin: isi.terminSequence,
      nominal: isi.amount,
      jatuhTempo: isi.dueDate.toISOString(),
    },
    now,
  });
  if (!submission.ok) return refuse(submission.reason);

  const invoice = await prisma.invoice.create({
    data: {
      number: isi.number,
      projectId: termin.project.id,
      terminId: termin.id,
      submissionId: submission.submissionId,
      clientName: isi.clientName,
      amount: isi.amount,
      dueDate: isi.dueDate,
      description: isi.description,
      notes: isi.notes,
      issuedById: input.actor.userId,
      issuedAt: now,
    },
    select: { id: true },
  });

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.INVOICE_REQUESTED,
    objectType: AUDIT_OBJECTS.INVOICE,
    objectId: invoice.id,
    after: {
      nomor: isi.number,
      projectId: termin.project.projectId,
      termin: isi.terminSequence,
      nominal: isi.amount,
      langkahBerjalan: submission.currentStepOrder,
    },
  });

  return {
    ok: true,
    invoiceId: invoice.id,
    submissionId: submission.submissionId,
    number: isi.number,
    amount: isi.amount,
    currentStepOrder: submission.currentStepOrder,
  };
}

export interface ProjectInvoiceRow {
  id: string;
  number: string;
  terminSequence: number;
  clientName: string;
  amount: string;
  dueDate: Date;
  description: string | null;
  notes: string | null;
  issuedAt: Date;
  issuedBy: string;
  submissionId: string;
  submissionStatus: "PENDING" | "APPROVED" | "REJECTED";
  /** Langkah yang sedang menunggu keputusan, kosong bila sudah selesai. */
  currentStepLabel: string | null;
}

/**
 * Invoice sebuah project beserta langkah persetujuan yang sedang menunggu.
 *
 * Nominal yang dikembalikan adalah salinan saat pengajuan dibuat, bukan
 * pembacaan ulang baris termin, supaya angka yang pernah dilihat penyetuju
 * tidak berubah di belakang layar.
 */
export async function readProjectInvoices(
  actor: Actor,
  projectDbId: string,
  now: Date = new Date(),
): Promise<{ ok: true; invoices: ProjectInvoiceRow[] } | Refusal> {
  const izin = checkPermission({ actor, action: "finance.view", now });
  if (!izin.allowed) return refuse(izin.reason);

  const rows = await prisma.invoice.findMany({
    where: { projectId: projectDbId },
    orderBy: [{ issuedAt: "asc" }],
    select: {
      id: true,
      number: true,
      clientName: true,
      amount: true,
      dueDate: true,
      description: true,
      notes: true,
      issuedAt: true,
      issuedBy: { select: { name: true } },
      termin: { select: { sequence: true } },
      submission: {
        select: {
          id: true,
          status: true,
          currentStepOrder: true,
          revision: true,
          steps: { select: { order: true, label: true, revision: true } },
        },
      },
    },
  });

  return {
    ok: true,
    invoices: rows.map((row) => ({
      id: row.id,
      number: row.number,
      terminSequence: row.termin.sequence,
      clientName: row.clientName,
      amount: row.amount.toString(),
      dueDate: row.dueDate,
      description: row.description,
      notes: row.notes,
      issuedAt: row.issuedAt,
      issuedBy: row.issuedBy.name,
      submissionId: row.submission.id,
      submissionStatus: row.submission.status,
      currentStepLabel:
        row.submission.steps.find(
          (step) =>
            step.revision === row.submission.revision &&
            step.order === row.submission.currentStepOrder,
        )?.label ?? null,
    })),
  };
}
