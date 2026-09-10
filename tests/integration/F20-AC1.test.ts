import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { requestInvoice } from "@/server/finance/invoice";
import {
  readProjectReceipts,
  recordTransferProof,
} from "@/server/finance/receipt";
import { assignProjectManager } from "@/server/project/assignment";
import { registerProject } from "@/server/project/registration";
import { saveTerminScheme } from "@/server/project/termin";
import {
  actorFrom,
  testDb,
  uniqueEmail,
  uniquePeriod,
} from "../support/database";

const PREFIX = "f20ac1-";
const PERIOD = uniquePeriod();
const BUKTI = "https://drive.google.com/file/d/bukti-transfer-dp/view";

let coo: Awaited<ReturnType<typeof actorFrom>>;
let pm: Awaited<ReturnType<typeof actorFrom>>;
let projectDbId: string;
let projectId: string;
let invoiceDp: string;
let projectLainId: string;

async function siapkanProject(nama: string, period: string) {
  const pendaftaran = await registerProject({
    actor: coo.actor,
    input: {
      name: nama,
      clientName: "PT Contoh Sejahtera",
      period,
      value: 10_000_000,
    },
  });
  if (!pendaftaran.registered) {
    throw new Error(`Pendaftaran gagal: ${pendaftaran.reason}`);
  }

  await assignProjectManager({
    actor: coo.actor,
    projectDbId: pendaftaran.id,
    pmUserId: pm.userId,
  });

  const skema = await saveTerminScheme({
    actor: coo.actor,
    projectDbId: pendaftaran.id,
    drafts: [
      { sequence: 1, percentage: "30", dueDate: "2026-10-01T00:00:00.000Z" },
      { sequence: 2, percentage: "70", dueDate: "2026-12-01T00:00:00.000Z" },
    ],
  });
  if (!skema.ok) throw new Error(`Skema termin gagal: ${skema.reason}`);

  return pendaftaran;
}

beforeAll(async () => {
  coo = await actorFrom(uniqueEmail(`${PREFIX}coo-`), "COO", "OPERATIONAL");
  pm = await actorFrom(
    uniqueEmail(`${PREFIX}pm-`),
    "PROJECT_MANAGER",
    "OPERATIONAL",
  );

  const utama = await siapkanProject("Project Kuitansi", PERIOD);
  projectDbId = utama.id;
  projectId = utama.projectId;

  const lain = await siapkanProject("Project Kuitansi Lain", uniquePeriod());
  projectLainId = lain.id;

  const termin = await testDb.termin.findFirstOrThrow({
    where: { projectId: projectDbId, sequence: 1 },
    select: { id: true },
  });

  const invoice = await requestInvoice({
    actor: pm.actor,
    terminId: termin.id,
  });
  if (!invoice.ok) throw new Error(`Invoice gagal: ${invoice.reason}`);
  invoiceDp = invoice.invoiceId;
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe("F20-AC1 Bukti transfer yang diunggah PM menempel pada invoice dan Project ID yang benar.", () => {
  it("Bukti transfer tercatat pada invoice yang ditunjuk, dengan nomor kuitansi dari Project ID-nya", async () => {
    const hasil = await recordTransferProof({
      actor: pm.actor,
      invoiceId: invoiceDp,
      amount: "3000000",
      paidAt: new Date("2026-09-20T00:00:00.000Z"),
      proofUrl: BUKTI,
      proofNote: "Transfer BCA a.n. PT Contoh Sejahtera",
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;

    expect(hasil.number).toBe(`#01-${projectId}`);
    expect(hasil.warning).toBeNull();

    const tersimpan = await testDb.receipt.findUniqueOrThrow({
      where: { id: hasil.receiptId },
      select: {
        invoiceId: true,
        projectId: true,
        proofUrl: true,
        status: true,
        invoice: {
          select: { projectId: true, termin: { select: { sequence: true } } },
        },
      },
    });

    expect(tersimpan.invoiceId).toBe(invoiceDp);
    expect(tersimpan.projectId).toBe(projectDbId);
    expect(tersimpan.invoice.projectId).toBe(projectDbId);
    expect(tersimpan.invoice.termin.sequence).toBe(1);
    expect(tersimpan.proofUrl).toBe(BUKTI);
    expect(tersimpan.status).toBe("RECORDED");
  });

  it("Kuitansi terbaca lewat project yang benar", async () => {
    const daftar = await readProjectReceipts(pm.actor, projectDbId);

    expect(daftar.ok).toBe(true);
    if (!daftar.ok) return;
    expect(daftar.receipts).toHaveLength(1);
    expect(daftar.receipts[0].terminSequence).toBe(1);
    expect(daftar.receipts[0].warning).toBeNull();

    const lain = await readProjectReceipts(pm.actor, projectLainId);
    expect(lain.ok).toBe(true);
    if (!lain.ok) return;
    expect(lain.receipts).toHaveLength(0);
  });

  it("Pencatatannya meninggalkan jejak aktivitas", async () => {
    const daftar = await readProjectReceipts(pm.actor, projectDbId);
    if (!daftar.ok) throw new Error(daftar.reason);

    const jejak = await testDb.auditLog.findFirst({
      where: {
        action: AUDIT_ACTIONS.RECEIPT_RECORDED,
        objectType: AUDIT_OBJECTS.RECEIPT,
        objectId: daftar.receipts[0].id,
      },
      select: { actorId: true },
    });

    expect(jejak?.actorId).toBe(pm.userId);
  });

  it("Satu invoice tidak bisa punya kuitansi kedua", async () => {
    const hasil = await recordTransferProof({
      actor: pm.actor,
      invoiceId: invoiceDp,
      amount: "3000000",
      paidAt: new Date("2026-09-21T00:00:00.000Z"),
      proofUrl: "https://drive.google.com/file/d/bukti-kedua/view",
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.reason).toContain("sudah punya bukti transfer");
  });

  it("Basis data menolak kuitansi yang projectnya menyimpang dari invoicenya", async () => {
    const daftar = await readProjectReceipts(pm.actor, projectDbId);
    if (!daftar.ok) throw new Error(daftar.reason);

    await expect(
      testDb.receipt.update({
        where: { id: daftar.receipts[0].id },
        data: { projectId: projectLainId },
      }),
    ).rejects.toThrow(/project yang berbeda/);
  });

  it("Tautan bukti yang bukan https ditolak", async () => {
    const termin = await testDb.termin.findFirstOrThrow({
      where: { projectId: projectDbId, sequence: 2 },
      select: { id: true },
    });
    const invoice = await requestInvoice({
      actor: pm.actor,
      terminId: termin.id,
    });
    if (!invoice.ok) throw new Error(invoice.reason);

    const hasil = await recordTransferProof({
      actor: pm.actor,
      invoiceId: invoice.invoiceId,
      amount: "7000000",
      paidAt: new Date("2026-11-20T00:00:00.000Z"),
      proofUrl: "bukti-transfer.png",
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.reason).toContain("https");
  });

  it("PM yang bukan pelaksana project tidak bisa mencatat bukti transfernya", async () => {
    const lain = await actorFrom(
      uniqueEmail(`${PREFIX}pm-lain-`),
      "PROJECT_MANAGER",
      "OPERATIONAL",
    );

    const hasil = await recordTransferProof({
      actor: lain.actor,
      invoiceId: invoiceDp,
      amount: "3000000",
      paidAt: new Date("2026-09-20T00:00:00.000Z"),
      proofUrl: BUKTI,
    });

    expect(hasil.ok).toBe(false);
  });
});
