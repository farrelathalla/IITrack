import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decideSubmission } from "@/server/approval/workflow";
import { requestInvoice } from "@/server/finance/invoice";
import { readFinanceQueue } from "@/server/finance/queue";
import { recordTransferProof, validateReceipt } from "@/server/finance/receipt";
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

const PREFIX = "f15-";
const PERIOD = uniquePeriod();
const BUKTI = "https://drive.google.com/file/d/bukti-antrean/view";

/** Selasa 1 September 2026 pukul 09.00 WIB. */
const DIAJUKAN = new Date("2026-09-01T09:00:00+07:00");
/** Selasa yang sama pukul 11.00 WIB, dua jam kerja sesudahnya. */
const DIAJUKAN_KEDUA = new Date("2026-09-01T11:00:00+07:00");
/** Selasa yang sama pukul 13.00 WIB. */
const DIBACA = new Date("2026-09-01T13:00:00+07:00");
/** Sabtu 5 September pukul 10.00 WIB. */
const SABTU = new Date("2026-09-05T10:00:00+07:00");

let coo: Awaited<ReturnType<typeof actorFrom>>;
let cfo: Awaited<ReturnType<typeof actorFrom>>;
let pm: Awaited<ReturnType<typeof actorFrom>>;
let financePoc: Awaited<ReturnType<typeof actorFrom>>;
let officer: Awaited<ReturnType<typeof actorFrom>>;
let programmer: Awaited<ReturnType<typeof actorFrom>>;
let projectDbId: string;
let projectId: string;
let invoiceDpId: string;
let submissionDpId: string;
let invoicePelunasanId: string;
let submissionPelunasanId: string;

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
  programmer = await actorFrom(
    uniqueEmail(`${PREFIX}dev-`),
    "TECHDEV_MEMBER",
    "TECHDEV",
  );

  const pendaftaran = await registerProject({
    actor: coo.actor,
    input: {
      name: "Project Antrean Finance",
      clientName: "PT Contoh Sejahtera",
      period: PERIOD,
      value: 10_000_000,
    },
  });
  if (!pendaftaran.registered) {
    throw new Error(`Pendaftaran gagal: ${pendaftaran.reason}`);
  }
  projectDbId = pendaftaran.id;
  projectId = pendaftaran.projectId;

  await assignProjectManager({
    actor: coo.actor,
    projectDbId,
    pmUserId: pm.userId,
  });

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

  const termins = await testDb.termin.findMany({
    where: { projectId: projectDbId },
    orderBy: { sequence: "asc" },
    select: { id: true },
  });

  const dp = await requestInvoice({
    actor: pm.actor,
    terminId: termins[0].id,
    now: DIAJUKAN,
  });
  if (!dp.ok) throw new Error(`Invoice DP gagal: ${dp.reason}`);
  invoiceDpId = dp.invoiceId;
  submissionDpId = dp.submissionId;

  const pelunasan = await requestInvoice({
    actor: pm.actor,
    terminId: termins[1].id,
    now: DIAJUKAN_KEDUA,
  });
  if (!pelunasan.ok) {
    throw new Error(`Invoice pelunasan gagal: ${pelunasan.reason}`);
  }
  invoicePelunasanId = pelunasan.invoiceId;
  submissionPelunasanId = pelunasan.submissionId;
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe("F15-AC1 Antrean menampilkan nomor dokumen, Project ID, client, nominal, jatuh tempo, status approval dan pembayaran, approver yang sedang memegang, serta lama menunggu.", () => {
  it("UAT-FIN-001, baris antrean memuat nomor, Project ID, client, nominal, jatuh tempo, status, pemegang, dan lama menunggu", async () => {
    const antrean = await readFinanceQueue(financePoc.actor, DIBACA);
    expect(antrean.ok).toBe(true);
    if (!antrean.ok) return;

    const baris = antrean.items.find((row) => row.invoiceId === invoiceDpId);
    expect(baris).toBeDefined();
    if (!baris) return;

    expect(baris.documentNumber).toBe(`#02-${projectId}`);
    expect(baris.projectId).toBe(projectId);
    expect(baris.clientName).toBe("PT Contoh Sejahtera");
    expect(Number(baris.amount)).toBe(3_000_000);
    expect(baris.dueDate.toISOString()).toBe("2026-10-01T00:00:00.000Z");
    expect(baris.approvalStatus).toBe("PENDING");
    expect(baris.paymentStatus).toBe("BELUM");
    expect(baris.holdingLabel).toBe("Finance POC");
    expect(baris.waitingSince.toISOString()).toBe(DIAJUKAN.toISOString());
    expect(baris.waitingWorkingMinutes).toBe(240);
  });

  it("Yang tertahan lebih lama tampil lebih dulu", async () => {
    const antrean = await readFinanceQueue(financePoc.actor, DIBACA);
    expect(antrean.ok).toBe(true);
    if (!antrean.ok) return;

    const posisiDp = antrean.items.findIndex(
      (row) => row.invoiceId === invoiceDpId,
    );
    const posisiPelunasan = antrean.items.findIndex(
      (row) => row.invoiceId === invoicePelunasanId,
    );

    expect(posisiDp).toBeGreaterThanOrEqual(0);
    expect(posisiPelunasan).toBeGreaterThan(posisiDp);
  });

  it("Akhir pekan tidak dihitung sebagai lama menunggu", async () => {
    const antrean = await readFinanceQueue(financePoc.actor, SABTU);
    expect(antrean.ok).toBe(true);
    if (!antrean.ok) return;

    const baris = antrean.items.find((row) => row.invoiceId === invoiceDpId);
    expect(baris?.waitingWorkingMinutes).toBe(1920);
  });

  it("Pengajuan yang ditolak hilang dari antrean", async () => {
    const keputusan = await decideSubmission({
      actor: financePoc.actor,
      submissionId: submissionPelunasanId,
      decision: "REJECTED",
      reason: "Nominal termin tidak sesuai MoU.",
      now: DIBACA,
    });
    expect(keputusan.ok).toBe(true);

    const antrean = await readFinanceQueue(financePoc.actor, DIBACA);
    expect(antrean.ok).toBe(true);
    if (!antrean.ok) return;
    expect(
      antrean.items.find((row) => row.invoiceId === invoicePelunasanId),
    ).toBeUndefined();
  });
});

describe("F15-AC2 PM dan Finance sama-sama bisa melihat sebuah pengajuan sedang menunggu siapa dan sejak kapan.", () => {
  it("UAT-FIN-002, PM dan Finance POC melihat pemegang dan waktu masuk yang sama", async () => {
    const [dariPm, dariFinance] = await Promise.all([
      readFinanceQueue(pm.actor, DIBACA),
      readFinanceQueue(financePoc.actor, DIBACA),
    ]);

    expect(dariPm.ok).toBe(true);
    expect(dariFinance.ok).toBe(true);
    if (!dariPm.ok || !dariFinance.ok) return;

    const milikiPm = dariPm.items.find((row) => row.invoiceId === invoiceDpId);
    const milikFinance = dariFinance.items.find(
      (row) => row.invoiceId === invoiceDpId,
    );

    expect(milikiPm?.holdingLabel).toBe("Finance POC");
    expect(milikFinance?.holdingLabel).toBe("Finance POC");
    expect(milikiPm?.waitingSince.toISOString()).toBe(DIAJUKAN.toISOString());
    expect(milikFinance?.waitingSince.toISOString()).toBe(
      DIAJUKAN.toISOString(),
    );
  });

  it("Anggota TechDev yang mengerjakan kode tidak bisa membaca antrean", async () => {
    const antrean = await readFinanceQueue(programmer.actor, DIBACA);

    expect(antrean.ok).toBe(false);
    if (antrean.ok) return;
    expect(antrean.reason).toContain("wewenang");
  });

  it("Setelah disetujui, antrean tetap menampilkan baris yang menunggu pembayaran lalu verifikasi, dan lunas hilang", async () => {
    for (const aktor of [financePoc, officer, cfo]) {
      const keputusan = await decideSubmission({
        actor: aktor.actor,
        submissionId: submissionDpId,
        decision: "APPROVED",
        now: DIBACA,
      });
      if (!keputusan.ok) throw new Error(`Approval gagal: ${keputusan.reason}`);
    }

    const menungguBayar = await readFinanceQueue(pm.actor, DIBACA);
    expect(menungguBayar.ok).toBe(true);
    if (!menungguBayar.ok) return;
    const setelahSetuju = menungguBayar.items.find(
      (row) => row.invoiceId === invoiceDpId,
    );
    expect(setelahSetuju?.state).toBe("MENUNGGU_PEMBAYARAN");
    expect(setelahSetuju?.holdingLabel).toBeNull();
    expect(setelahSetuju?.paymentStatus).toBe("MENUNGGU");

    const bukti = await recordTransferProof({
      actor: pm.actor,
      invoiceId: invoiceDpId,
      amount: "3000000",
      paidAt: DIBACA,
      proofUrl: BUKTI,
      now: DIBACA,
    });
    expect(bukti.ok).toBe(true);
    if (!bukti.ok) return;

    const menungguValidasi = await readFinanceQueue(financePoc.actor, DIBACA);
    expect(menungguValidasi.ok).toBe(true);
    if (!menungguValidasi.ok) return;
    const setelahBukti = menungguValidasi.items.find(
      (row) => row.invoiceId === invoiceDpId,
    );
    expect(setelahBukti?.state).toBe("MENUNGGU_VERIFIKASI");
    expect(setelahBukti?.holdingLabel).toBe("Finance POC");
    expect(setelahBukti?.paymentStatus).toBe("RECORDED");

    const valid = await validateReceipt({
      actor: financePoc.actor,
      receiptId: bukti.receiptId,
      now: DIBACA,
    });
    expect(valid.ok).toBe(true);

    const sesudahLunas = await readFinanceQueue(financePoc.actor, DIBACA);
    expect(sesudahLunas.ok).toBe(true);
    if (!sesudahLunas.ok) return;
    expect(
      sesudahLunas.items.find((row) => row.invoiceId === invoiceDpId),
    ).toBeUndefined();
  });
});
