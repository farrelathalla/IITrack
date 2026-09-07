import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decideSubmission } from "@/server/approval/workflow";
import { requestInvoice } from "@/server/finance/invoice";
import {
  readProjectReceipts,
  recordTransferProof,
  validateReceipt,
} from "@/server/finance/receipt";
import { assignProjectManager } from "@/server/project/assignment";
import { assignMember } from "@/server/project/members";
import { registerProject } from "@/server/project/registration";
import { saveTerminScheme } from "@/server/project/termin";
import {
  actorFrom,
  testDb,
  uniqueEmail,
  uniquePeriod,
} from "../support/database";

const PREFIX = "f20ac2-";
const PERIOD = uniquePeriod();
const BUKTI = "https://drive.google.com/file/d/bukti-selisih/view";
const PENYELESAIAN = "Selisih 50.000 adalah biaya transfer antarbank.";

let coo: Awaited<ReturnType<typeof actorFrom>>;
let cfo: Awaited<ReturnType<typeof actorFrom>>;
let pm: Awaited<ReturnType<typeof actorFrom>>;
let financePoc: Awaited<ReturnType<typeof actorFrom>>;
let officer: Awaited<ReturnType<typeof actorFrom>>;
let projectDbId: string;
let receiptId: string;

beforeAll(async () => {
  coo = await actorFrom(uniqueEmail(`${PREFIX}coo-`), "COO", "OPERATIONAL");
  cfo = await actorFrom(uniqueEmail(`${PREFIX}cfo-`), "CFO", "FINANCE");
  pm = await actorFrom(
    uniqueEmail(`${PREFIX}pm-`),
    "PROJECT_MANAGER",
    "OPERATIONAL",
  );
  financePoc = await actorFrom(
    uniqueEmail(`${PREFIX}poc-`),
    "FINANCE_POC",
    "FINANCE",
  );
  officer = await actorFrom(
    uniqueEmail(`${PREFIX}officer-`),
    "OFFICER_OPERATIONAL",
    "OPERATIONAL",
  );

  const pendaftaran = await registerProject({
    actor: coo.actor,
    input: {
      name: "Project Kuitansi Selisih",
      clientName: "PT Contoh Sejahtera",
      period: PERIOD,
      value: 10_000_000,
    },
  });
  if (!pendaftaran.registered) {
    throw new Error(`Pendaftaran gagal: ${pendaftaran.reason}`);
  }
  projectDbId = pendaftaran.id;

  await assignProjectManager({
    actor: coo.actor,
    projectDbId,
    pmUserId: pm.userId,
  });

  // Finance POC memperoleh hak action Finance pada project ini lewat penugasan
  // (F31), bukan lewat pengaturan izin manual.
  const penugasan = await assignMember({
    actor: cfo.actor,
    projectDbId,
    userId: financePoc.userId,
    division: "FINANCE",
  });
  if (!penugasan.ok) throw new Error(`Penugasan gagal: ${penugasan.reason}`);

  const skema = await saveTerminScheme({
    actor: coo.actor,
    projectDbId,
    drafts: [
      { sequence: 1, percentage: "30", dueDate: "2026-10-01T00:00:00.000Z" },
      { sequence: 2, percentage: "70", dueDate: "2026-12-01T00:00:00.000Z" },
    ],
  });
  if (!skema.ok) throw new Error(`Skema termin gagal: ${skema.reason}`);

  const termin = await testDb.termin.findFirstOrThrow({
    where: { projectId: projectDbId, sequence: 1 },
    select: { id: true },
  });

  const invoice = await requestInvoice({
    actor: pm.actor,
    terminId: termin.id,
  });
  if (!invoice.ok) throw new Error(`Invoice gagal: ${invoice.reason}`);

  // Nilainya sengaja 50.000 lebih kecil dari invoice.
  const bukti = await recordTransferProof({
    actor: pm.actor,
    invoiceId: invoice.invoiceId,
    amount: "2950000",
    paidAt: new Date("2026-09-20T00:00:00.000Z"),
    proofUrl: BUKTI,
  });
  if (!bukti.ok) throw new Error(`Bukti transfer gagal: ${bukti.reason}`);
  receiptId = bukti.receiptId;

  // Rantai invoice: Finance POC, POC dokumentasi, lalu CFO.
  for (const aktor of [financePoc, officer, cfo]) {
    const keputusan = await decideSubmission({
      actor: aktor.actor,
      submissionId: invoice.submissionId,
      decision: "APPROVED",
    });
    if (!keputusan.ok) throw new Error(`Approval gagal: ${keputusan.reason}`);
  }
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe("F20-AC2 Kuitansi yang nilainya tidak sama dengan invoice rujukannya tidak bisa dinyatakan valid tanpa penyelesaian, dan sistem menampilkan peringatannya.", () => {
  it("Selisih sudah terlihat sebagai peringatan sejak buktinya dicatat", async () => {
    const daftar = await readProjectReceipts(financePoc.actor, projectDbId);

    expect(daftar.ok).toBe(true);
    if (!daftar.ok) return;

    const kuitansi = daftar.receipts[0];
    expect(kuitansi.warning).toContain("lebih kecil");
    expect(kuitansi.warning).toContain("50000.00");
    expect(kuitansi.status).toBe("RECORDED");
  });

  it("Finance POC tidak bisa menyatakannya valid tanpa penyelesaian", async () => {
    const hasil = await validateReceipt({
      actor: financePoc.actor,
      receiptId,
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.reason).toContain("50000.00");
    expect(hasil.reason).toContain("penyelesaiannya ditulis lebih dulu");
  });

  it("Penolakan itu tidak mengubah apa pun di basis data", async () => {
    const kuitansi = await testDb.receipt.findUniqueOrThrow({
      where: { id: receiptId },
      select: { status: true, validatedById: true, resolution: true },
    });

    expect(kuitansi.status).toBe("RECORDED");
    expect(kuitansi.validatedById).toBeNull();
    expect(kuitansi.resolution).toBeNull();
  });

  it("Penyelesaian yang isinya hanya spasi tetap ditolak", async () => {
    const hasil = await validateReceipt({
      actor: financePoc.actor,
      receiptId,
      resolution: "   ",
    });

    expect(hasil.ok).toBe(false);
  });

  it("Basis data ikut menolak, bukan hanya aplikasi", async () => {
    await expect(
      testDb.receipt.update({
        where: { id: receiptId },
        data: {
          status: "VALID",
          validatedById: financePoc.userId,
          validatedAt: new Date(),
        },
      }),
    ).rejects.toThrow(/tanpa penyelesaian tertulis/);
  });

  it("Dengan penyelesaian tertulis, kuitansinya bisa dinyatakan valid", async () => {
    const hasil = await validateReceipt({
      actor: financePoc.actor,
      receiptId,
      resolution: PENYELESAIAN,
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.matches).toBe(false);

    const kuitansi = await testDb.receipt.findUniqueOrThrow({
      where: { id: receiptId },
      select: { status: true, resolution: true, validatedById: true },
    });

    expect(kuitansi.status).toBe("VALID");
    expect(kuitansi.resolution).toBe(PENYELESAIAN);
    expect(kuitansi.validatedById).toBe(financePoc.userId);
  });

  it("Kuitansi yang sudah valid tidak bisa dinyatakan valid dua kali", async () => {
    const hasil = await validateReceipt({
      actor: financePoc.actor,
      receiptId,
      resolution: PENYELESAIAN,
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.reason).toContain("sudah dinyatakan valid");
  });

  it("PM tidak bisa menyatakan kuitansinya sendiri valid", async () => {
    const kedua = await testDb.termin.findFirstOrThrow({
      where: { projectId: projectDbId, sequence: 2 },
      select: { id: true },
    });
    const invoice = await requestInvoice({
      actor: pm.actor,
      terminId: kedua.id,
    });
    if (!invoice.ok) throw new Error(invoice.reason);

    const bukti = await recordTransferProof({
      actor: pm.actor,
      invoiceId: invoice.invoiceId,
      amount: "7000000",
      paidAt: new Date("2026-11-20T00:00:00.000Z"),
      proofUrl: "https://drive.google.com/file/d/bukti-pelunasan/view",
    });
    if (!bukti.ok) throw new Error(bukti.reason);

    const hasil = await validateReceipt({
      actor: pm.actor,
      receiptId: bukti.receiptId,
    });

    expect(hasil.ok).toBe(false);
  });

  it("Kuitansi atas invoice yang belum selesai disetujui belum bisa valid", async () => {
    const kedua = await testDb.receipt.findFirstOrThrow({
      where: { projectId: projectDbId, invoice: { termin: { sequence: 2 } } },
      select: { id: true },
    });

    const hasil = await validateReceipt({
      actor: financePoc.actor,
      receiptId: kedua.id,
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.reason).toContain("belum selesai disetujui");
  });
});
