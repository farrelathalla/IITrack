import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { decideSubmission } from "@/server/approval/workflow";
import { readFinanceChain } from "@/server/finance/chain";
import { requestInvoice } from "@/server/finance/invoice";
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

const PREFIX = "xc03-";
const PERIOD = uniquePeriod();

/**
 * Batas waktu untuk langkah yang menyentuh banyak tabel sekaligus.
 *
 * Batas bawaan Vitest lima detik, sedangkan satu langkah rantai Finance bisa
 * melewatinya pada basis data lokal. Test yang mati di tengah jalan
 * meninggalkan koneksi dengan pernyataan yang belum selesai, dan seluruh test
 * sesudahnya ikut gagal dengan galat 08P01 yang menyesatkan.
 */
const LAMBAT = 20_000;

let coo: Awaited<ReturnType<typeof actorFrom>>;
let cfo: Awaited<ReturnType<typeof actorFrom>>;
let pm: Awaited<ReturnType<typeof actorFrom>>;
let financePoc: Awaited<ReturnType<typeof actorFrom>>;
let officer: Awaited<ReturnType<typeof actorFrom>>;
let projectDbId: string;
let terminDp: string;
let terminPelunasan: string;

/** Invoice dan kuitansi yang lahir sepanjang skenario. */
let invoiceDp: { invoiceId: string; submissionId: string };
let receiptDp: string;
let invoiceDitolak: { invoiceId: string; submissionId: string };

/** Aksi yang tercatat pada sebuah objek, terlama lebih dulu. */
async function jejakUntuk(objectId: string): Promise<string[]> {
  const rows = await testDb.auditLog.findMany({
    where: { objectId },
    orderBy: { createdAt: "asc" },
    select: { action: true },
  });
  return rows.map((row) => row.action);
}

async function rantai(actor = pm.actor) {
  const hasil = await readFinanceChain(actor, projectDbId);
  if (!hasil.ok) throw new Error(hasil.reason);
  return hasil.chain;
}

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
      name: "Project Integrasi Finance",
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
  terminDp = termins[0].id;
  terminPelunasan = termins[1].id;
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe("XC-03-AC1 Happy and rejection paths persist consistent state and append complete audit evidence.", () => {
  it("Rantai berangkat dari keadaan belum ditagihkan", async () => {
    const chain = await rantai();

    expect(chain.termins.map((row) => row.state)).toEqual([
      "BELUM_DITAGIHKAN",
      "BELUM_DITAGIHKAN",
    ]);
    expect(chain.inconsistencies).toEqual([]);
  });

  it(
    "Pengajuan invoice memindahkan termin ke menunggu persetujuan",
    async () => {
      const invoice = await requestInvoice({
        actor: pm.actor,
        terminId: terminDp,
      });
      if (!invoice.ok) throw new Error(invoice.reason);
      invoiceDp = invoice;

      const chain = await rantai();
      expect(chain.termins[0].state).toBe("MENUNGGU_PERSETUJUAN");
      expect(chain.termins[0].invoice?.currentStepLabel).toBe("Finance POC");
      expect(chain.inconsistencies).toEqual([]);
    },
    LAMBAT,
  );

  it(
    "Skema termin yang sudah ditagihkan ditolak dengan kalimat yang terbaca",
    async () => {
      const hasil = await saveTerminScheme({
        actor: coo.actor,
        projectDbId,
        drafts: [
          {
            sequence: 1,
            percentage: "40",
            dueDate: "2026-10-01T00:00:00.000Z",
          },
          {
            sequence: 2,
            percentage: "60",
            dueDate: "2026-12-01T00:00:00.000Z",
          },
        ],
      });

      expect(hasil.ok).toBe(false);
      if (hasil.ok) return;
      expect(hasil.reason).toContain("sudah pernah diajukan invoicenya");
      expect(hasil.reason).toContain("termin 1");

      const chain = await rantai();
      expect(chain.termins.map((row) => row.percentage)).toEqual(["30", "70"]);
    },
    LAMBAT,
  );

  it(
    "Rantai persetujuan yang selesai memindahkannya ke menunggu pembayaran",
    async () => {
      for (const aktor of [financePoc, officer, cfo]) {
        const keputusan = await decideSubmission({
          actor: aktor.actor,
          submissionId: invoiceDp.submissionId,
          decision: "APPROVED",
        });
        if (!keputusan.ok) throw new Error(keputusan.reason);
      }

      const chain = await rantai();
      expect(chain.termins[0].state).toBe("MENUNGGU_PEMBAYARAN");
      expect(chain.termins[0].invoice?.currentStepLabel).toBeNull();
    },
    LAMBAT,
  );

  it(
    "Bukti transfer memindahkannya ke menunggu verifikasi",
    async () => {
      const bukti = await recordTransferProof({
        actor: pm.actor,
        invoiceId: invoiceDp.invoiceId,
        amount: "3000000",
        paidAt: new Date("2026-09-20T00:00:00.000Z"),
        proofUrl: "https://drive.google.com/file/d/bukti-xc03-dp/view",
      });
      if (!bukti.ok) throw new Error(bukti.reason);
      receiptDp = bukti.receiptId;

      const chain = await rantai();
      expect(chain.termins[0].state).toBe("MENUNGGU_VERIFIKASI");
      expect(chain.termins[0].receipt?.warning).toBeNull();
      expect(chain.inconsistencies).toEqual([]);
    },
    LAMBAT,
  );

  it(
    "Kuitansi yang dinyatakan valid menutup terminnya",
    async () => {
      const validasi = await validateReceipt({
        actor: financePoc.actor,
        receiptId: receiptDp,
      });
      if (!validasi.ok) throw new Error(validasi.reason);

      const chain = await rantai();
      expect(chain.termins[0].state).toBe("LUNAS");
      expect(chain.termins[0].terminStatus).toBe("PAID");
      expect(chain.inconsistencies).toEqual([]);
    },
    LAMBAT,
  );

  it(
    "Jalur berhasil meninggalkan jejak audit yang lengkap",
    async () => {
      expect(await jejakUntuk(invoiceDp.invoiceId)).toEqual([
        AUDIT_ACTIONS.INVOICE_REQUESTED,
      ]);

      expect(await jejakUntuk(invoiceDp.submissionId)).toEqual([
        AUDIT_ACTIONS.SUBMISSION_CREATED,
        AUDIT_ACTIONS.SUBMISSION_STEP_APPROVED,
        AUDIT_ACTIONS.SUBMISSION_STEP_APPROVED,
        AUDIT_ACTIONS.SUBMISSION_STEP_APPROVED,
      ]);

      expect(await jejakUntuk(receiptDp)).toEqual([
        AUDIT_ACTIONS.RECEIPT_RECORDED,
        AUDIT_ACTIONS.RECEIPT_VALIDATED,
      ]);

      expect(await jejakUntuk(terminDp)).toEqual([
        AUDIT_ACTIONS.TERMIN_MARKED_PAID,
      ]);
    },
    LAMBAT,
  );

  it(
    "Jalur penolakan berhenti di ditolak tanpa menyentuh terminnya",
    async () => {
      const invoice = await requestInvoice({
        actor: pm.actor,
        terminId: terminPelunasan,
      });
      if (!invoice.ok) throw new Error(invoice.reason);
      invoiceDitolak = invoice;

      const ditolak = await decideSubmission({
        actor: financePoc.actor,
        submissionId: invoice.submissionId,
        decision: "REJECTED",
        reason: "Nomor rekening pada invoice belum diperbarui.",
      });
      if (!ditolak.ok) throw new Error(ditolak.reason);

      const chain = await rantai();
      expect(chain.termins[1].state).toBe("DITOLAK");
      expect(chain.termins[1].terminStatus).toBe("UNPAID");
      expect(chain.termins[1].receipt).toBeNull();
      expect(chain.inconsistencies).toEqual([]);
    },
    LAMBAT,
  );

  it(
    "Bukti transfer tidak bisa ditempelkan pada invoice yang ditolak",
    async () => {
      const hasil = await recordTransferProof({
        actor: pm.actor,
        invoiceId: invoiceDitolak.invoiceId,
        amount: "7000000",
        paidAt: new Date("2026-11-20T00:00:00.000Z"),
        proofUrl: "https://drive.google.com/file/d/bukti-xc03-tolak/view",
      });

      expect(hasil.ok).toBe(false);
      if (hasil.ok) return;
      expect(hasil.reason).toContain("ditolak pada rantai persetujuan");
    },
    LAMBAT,
  );

  it(
    "Jalur penolakan meninggalkan alasan penolakannya di jejak audit",
    async () => {
      expect(await jejakUntuk(invoiceDitolak.submissionId)).toEqual([
        AUDIT_ACTIONS.SUBMISSION_CREATED,
        AUDIT_ACTIONS.SUBMISSION_STEP_REJECTED,
      ]);

      const penolakan = await testDb.auditLog.findFirstOrThrow({
        where: {
          objectId: invoiceDitolak.submissionId,
          action: AUDIT_ACTIONS.SUBMISSION_STEP_REJECTED,
        },
        select: { reason: true, actorId: true },
      });

      expect(penolakan.reason).toBe(
        "Nomor rekening pada invoice belum diperbarui.",
      );
      expect(penolakan.actorId).toBe(financePoc.userId);
    },
    LAMBAT,
  );

  it(
    "Termin yang ditolak bisa diajukan ulang, dan yang lama tetap tercatat",
    async () => {
      const ulang = await requestInvoice({
        actor: pm.actor,
        terminId: terminPelunasan,
      });
      expect(ulang.ok).toBe(true);
      if (!ulang.ok) return;

      const chain = await rantai();
      expect(chain.termins[1].state).toBe("MENUNGGU_PERSETUJUAN");
      expect(chain.termins[1].invoice?.id).toBe(ulang.invoiceId);
      expect(chain.termins[1].superseded).toHaveLength(1);
      expect(chain.termins[1].superseded[0].submissionStatus).toBe("REJECTED");
      expect(chain.inconsistencies).toEqual([]);
    },
    LAMBAT,
  );

  it(
    "Seluruh rantai terbaca dalam satu permintaan, tanpa pertentangan keadaan",
    async () => {
      const chain = await rantai(financePoc.actor);

      expect(chain.termins.map((row) => row.state)).toEqual([
        "LUNAS",
        "MENUNGGU_PERSETUJUAN",
      ]);
      expect(chain.inconsistencies).toEqual([]);
      expect(chain.projectValue).toBeTruthy();
      expect(chain.clientName).toBe("PT Contoh Sejahtera");
    },
    LAMBAT,
  );

  it(
    "Pengguna tanpa hak lihat Finance tidak bisa membaca rantainya",
    async () => {
      const luar = await actorFrom(
        uniqueEmail(`${PREFIX}techdev-`),
        "TECHDEV_MEMBER",
        "TECHDEV",
      );

      const hasil = await readFinanceChain(luar.actor, projectDbId);
      expect(hasil.ok).toBe(false);
    },
    LAMBAT,
  );
});
