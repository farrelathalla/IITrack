import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { checkPermission } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import { formatDocumentNumber } from "@/lib/document/numbering";
import { compareReceiptAmount, verdictForReceipt } from "@/lib/finance/receipt";
import { normalizeReferenceUrl } from "@/lib/project/external-reference";
import { recordAudit } from "@/server/audit";
import { prisma } from "@/server/db";
import { projectContextFor } from "@/server/project/context";

export type Refusal = { ok: false; reason: string };

function refuse(reason: string): Refusal {
  return { ok: false, reason };
}

export interface RecordTransferProofInput {
  actor: Actor;
  invoiceId: string;
  /** Nilai yang benar-benar diterima menurut bukti transfer. */
  amount: string | number;
  paidAt: Date;
  proofUrl: string;
  proofNote?: string | null;
  now?: Date;
}

export interface RecordTransferProofResult {
  ok: true;
  receiptId: string;
  number: string;
  /** Peringatan selisih terhadap invoice, kosong bila nilainya sama. */
  warning: string | null;
}

/**
 * Mencatat bukti transfer terhadap sebuah invoice (F20-AC1).
 *
 * Kuitansi tidak dibuat berdiri sendiri: nomornya, Project ID-nya, dan termin
 * yang ditutupnya semua diturunkan dari invoice yang ditunjuk. Pengaju hanya
 * menyebut invoicenya, sehingga bukti transfer tidak bisa menempel pada project
 * yang salah karena salah ketik.
 *
 * Selisih terhadap invoice tidak menghalangi pencatatan, hanya dikembalikan
 * sebagai peringatan. Yang menahan selisih adalah penetapan valid, bukan
 * penerimaan buktinya, karena bukti yang nilainya meleset justru perlu tercatat
 * supaya bisa ditindaklanjuti.
 */
export async function recordTransferProof(
  input: RecordTransferProofInput,
): Promise<RecordTransferProofResult | Refusal> {
  const now = input.now ?? new Date();

  const invoice = await prisma.invoice.findUnique({
    where: { id: input.invoiceId },
    select: {
      id: true,
      amount: true,
      projectId: true,
      project: { select: { projectId: true } },
      receipt: { select: { id: true } },
    },
  });
  if (!invoice) return refuse("Invoice yang dimaksud tidak ditemukan.");

  // Izin diperiksa sebelum keadaan invoice diberitahukan, sama seperti F16.
  const konteks = await projectContextFor(input.actor, invoice.projectId, now);
  const izin = checkPermission({
    actor: input.actor,
    action: "finance.submit",
    project: konteks,
    now,
  });
  if (!izin.allowed) return refuse(izin.reason);

  if (invoice.receipt) {
    return refuse(
      "Invoice ini sudah punya bukti transfer yang tercatat. Perbaiki yang sudah ada, jangan menambah kuitansi kedua.",
    );
  }

  const proofUrl = normalizeReferenceUrl(input.proofUrl);
  if (!proofUrl) {
    return refuse(
      "Tautan bukti transfer harus berupa alamat https yang lengkap, supaya bisa dibuka kembali dari Project Hub.",
    );
  }

  const perbandingan = compareReceiptAmount(
    invoice.amount.toString(),
    input.amount,
  );
  if (!perbandingan.readable) return refuse(perbandingan.reason);

  const receipt = await prisma.receipt.create({
    data: {
      number: formatDocumentNumber("RECEIPT", invoice.project.projectId),
      invoiceId: invoice.id,
      projectId: invoice.projectId,
      amount: String(input.amount),
      paidAt: input.paidAt,
      proofUrl,
      proofNote: input.proofNote?.trim() || null,
      recordedById: input.actor.userId,
      recordedAt: now,
    },
    select: { id: true, number: true },
  });

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.RECEIPT_RECORDED,
    objectType: AUDIT_OBJECTS.RECEIPT,
    objectId: receipt.id,
    after: {
      nomor: receipt.number,
      projectId: invoice.project.projectId,
      invoiceId: invoice.id,
      nominal: String(input.amount),
      selisih: perbandingan.difference,
      bukti: proofUrl,
    },
  });

  return {
    ok: true,
    receiptId: receipt.id,
    number: receipt.number,
    warning: perbandingan.warning,
  };
}

export interface ValidateReceiptInput {
  actor: Actor;
  receiptId: string;
  /** Penjelasan tertulis atas selisih. Wajib bila nilainya berbeda. */
  resolution?: string | null;
  now?: Date;
}

export interface ValidateReceiptResult {
  ok: true;
  receiptId: string;
  /** Apakah nilainya sama persis dengan invoice rujukannya. */
  matches: boolean;
  terminSequence: number;
  terminStatus: "PAID";
}

/**
 * Menyatakan sebuah kuitansi valid, lalu menutup terminnya (F20-AC2, F20-AC3).
 *
 * Dua hal terjadi dalam satu transaksi: kuitansinya berubah menjadi VALID, dan
 * termin yang ditagihkan invoicenya berubah menjadi lunas. Keduanya sengaja
 * tidak bisa berjalan sendiri-sendiri, karena kuitansi valid yang terminnya
 * masih tertagih adalah keadaan yang tidak berarti apa-apa.
 */
export async function validateReceipt(
  input: ValidateReceiptInput,
): Promise<ValidateReceiptResult | Refusal> {
  const now = input.now ?? new Date();

  const receipt = await prisma.receipt.findUnique({
    where: { id: input.receiptId },
    select: {
      id: true,
      status: true,
      amount: true,
      projectId: true,
      invoice: {
        select: {
          id: true,
          amount: true,
          terminId: true,
          termin: { select: { id: true, sequence: true, status: true } },
          submission: { select: { status: true } },
        },
      },
    },
  });
  if (!receipt) return refuse("Kuitansi yang dimaksud tidak ditemukan.");

  const konteks = await projectContextFor(input.actor, receipt.projectId, now);
  const izin = checkPermission({
    actor: input.actor,
    action: "finance.edit",
    project: konteks,
    now,
  });
  if (!izin.allowed) return refuse(izin.reason);

  if (receipt.status === "VALID") {
    return refuse("Kuitansi ini sudah dinyatakan valid sebelumnya.");
  }

  // Kuitansi menyatakan bahwa client membayar sebuah invoice. Invoice yang
  // rantai persetujuannya belum selesai belum pernah sah dikirim ke client,
  // jadi menerbitkan kuitansinya berarti mengakui tagihan yang belum disetujui.
  if (receipt.invoice.submission.status !== "APPROVED") {
    return refuse(
      "Invoice rujukannya belum selesai disetujui, jadi kuitansinya belum bisa dinyatakan valid.",
    );
  }

  const putusan = verdictForReceipt({
    invoiceAmount: receipt.invoice.amount.toString(),
    receiptAmount: receipt.amount.toString(),
    resolution: input.resolution,
  });
  if (!putusan.valid) return refuse(putusan.reason);

  const termin = receipt.invoice.termin;

  await prisma.$transaction([
    prisma.receipt.update({
      where: { id: receipt.id },
      data: {
        status: "VALID",
        resolution: putusan.resolution,
        validatedById: input.actor.userId,
        validatedAt: now,
      },
    }),
    prisma.termin.update({
      where: { id: termin.id },
      data: { status: "PAID" },
    }),
  ]);

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.RECEIPT_VALIDATED,
    objectType: AUDIT_OBJECTS.RECEIPT,
    objectId: receipt.id,
    before: { status: "RECORDED" },
    after: {
      status: "VALID",
      nilaiSama: putusan.matches,
      penyelesaian: putusan.resolution,
    },
    reason: putusan.resolution,
  });

  await recordAudit({
    actorId: input.actor.userId,
    action: AUDIT_ACTIONS.TERMIN_MARKED_PAID,
    objectType: AUDIT_OBJECTS.TERMIN,
    objectId: termin.id,
    before: { status: termin.status },
    after: { status: "PAID", kuitansiId: receipt.id },
  });

  return {
    ok: true,
    receiptId: receipt.id,
    matches: putusan.matches,
    terminSequence: termin.sequence,
    terminStatus: "PAID",
  };
}

export interface ProjectReceiptRow {
  id: string;
  number: string;
  invoiceId: string;
  invoiceNumber: string;
  terminSequence: number;
  amount: string;
  invoiceAmount: string;
  paidAt: Date;
  proofUrl: string;
  proofNote: string | null;
  status: "RECORDED" | "VALID";
  resolution: string | null;
  /** Peringatan selisih yang siap ditampilkan, kosong bila nilainya sama. */
  warning: string | null;
  recordedBy: string;
  recordedAt: Date;
  validatedBy: string | null;
  validatedAt: Date | null;
}

/**
 * Kuitansi sebuah project beserta peringatan selisihnya.
 *
 * Peringatannya dihitung ulang saat dibaca, bukan disimpan, supaya kalimat yang
 * dilihat Finance POC selalu berasal dari angka yang sedang berlaku.
 */
export async function readProjectReceipts(
  actor: Actor,
  projectDbId: string,
  now: Date = new Date(),
): Promise<{ ok: true; receipts: ProjectReceiptRow[] } | Refusal> {
  const izin = checkPermission({ actor, action: "finance.view", now });
  if (!izin.allowed) return refuse(izin.reason);

  const rows = await prisma.receipt.findMany({
    where: { projectId: projectDbId },
    orderBy: [{ recordedAt: "asc" }],
    select: {
      id: true,
      number: true,
      amount: true,
      paidAt: true,
      proofUrl: true,
      proofNote: true,
      status: true,
      resolution: true,
      recordedAt: true,
      validatedAt: true,
      recordedBy: { select: { name: true } },
      validatedBy: { select: { name: true } },
      invoice: {
        select: {
          id: true,
          number: true,
          amount: true,
          termin: { select: { sequence: true } },
        },
      },
    },
  });

  return {
    ok: true,
    receipts: rows.map((row) => {
      const perbandingan = compareReceiptAmount(
        row.invoice.amount.toString(),
        row.amount.toString(),
      );

      return {
        id: row.id,
        number: row.number,
        invoiceId: row.invoice.id,
        invoiceNumber: row.invoice.number,
        terminSequence: row.invoice.termin.sequence,
        amount: row.amount.toString(),
        invoiceAmount: row.invoice.amount.toString(),
        paidAt: row.paidAt,
        proofUrl: row.proofUrl,
        proofNote: row.proofNote,
        status: row.status,
        resolution: row.resolution,
        warning: perbandingan.readable ? perbandingan.warning : null,
        recordedBy: row.recordedBy.name,
        recordedAt: row.recordedAt,
        validatedBy: row.validatedBy?.name ?? null,
        validatedAt: row.validatedAt,
      };
    }),
  };
}
