import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { decideSubmission, reviseSubmission } from "@/server/approval/workflow";
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

/**
 * UAT-APR-003 Reject Request, beserta perbaikannya.
 *
 * Menjalankan jalur penolakan pengajuan invoice sampai perbaikannya diterima,
 * pada project yang sama. Yang diuji bukan hanya bahwa penolakannya bekerja,
 * melainkan bahwa riwayat penolakannya tidak hilang setelah diperbaiki, dan
 * bahwa perbaikan mengulang rantai dari langkah pertama.
 *
 * Perbaikan di sini adalah `reviseSubmission`: pengajuan yang sama diperbaiki
 * dan revisinya bertambah. Berbeda dengan mengajukan invoice baru untuk termin
 * yang sama, yang diuji terpisah pada F16-AC3.
 */

const PREFIX = "apr003-";
const PERIOD = uniquePeriod();
const LAMBAT = 30_000;

const ALASAN_TOLAK = "Nomor rekening pada invoice belum diperbarui.";

let coo: Awaited<ReturnType<typeof actorFrom>>;
let cfo: Awaited<ReturnType<typeof actorFrom>>;
let officer: Awaited<ReturnType<typeof actorFrom>>;
let pm: Awaited<ReturnType<typeof actorFrom>>;
let financePoc: Awaited<ReturnType<typeof actorFrom>>;

let projectDbId: string;
let terminDp: string;
let invoice: { invoiceId: string; submissionId: string };

async function chain() {
  const hasil = await readFinanceChain(pm.actor, projectDbId);
  if (!hasil.ok) throw new Error(hasil.reason);
  return hasil.chain;
}

beforeAll(async () => {
  coo = await actorFrom(uniqueEmail(`${PREFIX}coo-`), "COO", "OPERATIONAL");
  cfo = await actorFrom(uniqueEmail(`${PREFIX}cfo-`), "CFO", "FINANCE");
  officer = await actorFrom(
    uniqueEmail(`${PREFIX}officer-`),
    "OFFICER_OPERATIONAL",
    "OPERATIONAL",
  );
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

  const pendaftaran = await registerProject({
    actor: coo.actor,
    input: {
      name: "Project Penolakan",
      clientName: "PT Contoh Sejahtera",
      period: PERIOD,
      value: 10_000_000,
    },
  });
  if (!pendaftaran.registered) throw new Error(pendaftaran.reason);
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
  if (!penugasan.ok) throw new Error(penugasan.reason);

  const skema = await saveTerminScheme({
    actor: coo.actor,
    projectDbId,
    drafts: [
      { sequence: 1, percentage: "30", dueDate: "2026-10-01T00:00:00.000Z" },
      { sequence: 2, percentage: "70", dueDate: "2026-12-01T00:00:00.000Z" },
    ],
  });
  if (!skema.ok) throw new Error(skema.reason);

  const termin = await testDb.termin.findFirstOrThrow({
    where: { projectId: projectDbId, sequence: 1 },
    select: { id: true },
  });
  terminDp = termin.id;
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe("UAT-APR-003 Reject Request", () => {
  it(
    "PM mengajukan invoice dan rantainya berjalan sampai langkah kedua",
    async () => {
      const hasil = await requestInvoice({
        actor: pm.actor,
        terminId: terminDp,
      });
      if (!hasil.ok) throw new Error(hasil.reason);
      invoice = hasil;

      const disetujui = await decideSubmission({
        actor: financePoc.actor,
        submissionId: invoice.submissionId,
        decision: "APPROVED",
      });
      if (!disetujui.ok) throw new Error(disetujui.reason);

      expect((await chain()).termins[0].invoice?.currentStepLabel).toBe(
        "POC dokumentasi",
      );
    },
    LAMBAT,
  );

  it(
    "Penolakan tanpa alasan ditolak, dan langkahnya tidak ikut terpakai",
    async () => {
      const hasil = await decideSubmission({
        actor: officer.actor,
        submissionId: invoice.submissionId,
        decision: "REJECTED",
        reason: "   ",
      });

      expect(hasil.ok).toBe(false);

      // Langkahnya harus tetap menunggu, bukan terlanjur tercatat sebagai
      // sudah diputuskan hanya karena percobaan penolakannya gagal.
      expect((await chain()).termins[0].invoice?.currentStepLabel).toBe(
        "POC dokumentasi",
      );
    },
    LAMBAT,
  );

  it(
    "Penolakan beralasan menghentikan pengajuan tanpa menyentuh terminnya",
    async () => {
      const hasil = await decideSubmission({
        actor: officer.actor,
        submissionId: invoice.submissionId,
        decision: "REJECTED",
        reason: ALASAN_TOLAK,
      });
      if (!hasil.ok) throw new Error(hasil.reason);

      expect(hasil.status).toBe("REJECTED");

      const rantai = await chain();
      expect(rantai.termins[0].state).toBe("DITOLAK");
      expect(rantai.termins[0].terminStatus).toBe("UNPAID");
      expect(rantai.inconsistencies).toEqual([]);
    },
    LAMBAT,
  );

  it(
    "Bukti transfer tidak bisa masuk selama pengajuannya masih ditolak",
    async () => {
      const hasil = await recordTransferProof({
        actor: pm.actor,
        invoiceId: invoice.invoiceId,
        amount: "3000000",
        paidAt: new Date("2026-10-01T03:00:00.000Z"),
        proofUrl: "https://drive.google.com/file/d/bukti-apr003/view",
      });

      expect(hasil.ok).toBe(false);
    },
    LAMBAT,
  );

  it(
    "Hanya pengajunya yang bisa memperbaiki, dan perbaikan mengulang dari langkah pertama",
    async () => {
      const orangLain = await reviseSubmission({
        actor: officer.actor,
        submissionId: invoice.submissionId,
      });
      expect(orangLain.ok).toBe(false);

      const hasil = await reviseSubmission({
        actor: pm.actor,
        submissionId: invoice.submissionId,
      });
      if (!hasil.ok) throw new Error(hasil.reason);

      expect(hasil.revision).toBe(2);

      const rantai = await chain();
      expect(rantai.termins[0].state).toBe("MENUNGGU_PERSETUJUAN");
      expect(rantai.termins[0].invoice?.currentStepLabel).toBe("Finance POC");
    },
    LAMBAT,
  );

  it(
    "Riwayat penolakan lama tidak hilang setelah diperbaiki",
    async () => {
      const langkahLama = await testDb.approvalStep.findMany({
        where: { submissionId: invoice.submissionId, revision: 1 },
        orderBy: { order: "asc" },
        select: { order: true, decision: true, reason: true },
      });

      expect(langkahLama.map((row) => row.decision)).toEqual([
        "APPROVED",
        "REJECTED",
        "PENDING",
      ]);
      expect(langkahLama[1].reason).toBe(ALASAN_TOLAK);

      // Revisi kedua punya set langkahnya sendiri, semuanya masih menunggu.
      const langkahBaru = await testDb.approvalStep.findMany({
        where: { submissionId: invoice.submissionId, revision: 2 },
        select: { decision: true },
      });
      expect(langkahBaru).toHaveLength(3);
      expect(langkahBaru.every((row) => row.decision === "PENDING")).toBe(true);
    },
    LAMBAT,
  );

  it(
    "Perbaikan yang disetujui penuh menutup terminnya seperti jalur biasa",
    async () => {
      for (const aktor of [financePoc, officer, cfo]) {
        const keputusan = await decideSubmission({
          actor: aktor.actor,
          submissionId: invoice.submissionId,
          decision: "APPROVED",
        });
        if (!keputusan.ok) throw new Error(keputusan.reason);
      }

      const bukti = await recordTransferProof({
        actor: pm.actor,
        invoiceId: invoice.invoiceId,
        amount: "3000000",
        paidAt: new Date("2026-10-01T03:00:00.000Z"),
        proofUrl: "https://drive.google.com/file/d/bukti-apr003-revisi/view",
      });
      if (!bukti.ok) throw new Error(bukti.reason);

      const validasi = await validateReceipt({
        actor: financePoc.actor,
        receiptId: bukti.receiptId,
      });
      if (!validasi.ok) throw new Error(validasi.reason);

      const rantai = await chain();
      expect(rantai.termins[0].state).toBe("LUNAS");
      expect(rantai.termins[0].terminStatus).toBe("PAID");
      expect(rantai.inconsistencies).toEqual([]);
    },
    LAMBAT,
  );

  it(
    "Seluruh perjalanannya terbaca berurutan di jejak audit",
    async () => {
      const jejak = await testDb.auditLog.findMany({
        where: { objectId: invoice.submissionId },
        orderBy: { createdAt: "asc" },
        select: { action: true, reason: true },
      });

      expect(jejak.map((row) => row.action)).toEqual([
        AUDIT_ACTIONS.SUBMISSION_CREATED,
        AUDIT_ACTIONS.SUBMISSION_STEP_APPROVED,
        AUDIT_ACTIONS.SUBMISSION_STEP_REJECTED,
        AUDIT_ACTIONS.SUBMISSION_REVISED,
        AUDIT_ACTIONS.SUBMISSION_STEP_APPROVED,
        AUDIT_ACTIONS.SUBMISSION_STEP_APPROVED,
        AUDIT_ACTIONS.SUBMISSION_STEP_APPROVED,
      ]);

      // Alasan penolakannya masih terbaca setelah pengajuannya diperbaiki dan
      // akhirnya disetujui.
      expect(
        jejak.find(
          (row) => row.action === AUDIT_ACTIONS.SUBMISSION_STEP_REJECTED,
        )?.reason,
      ).toBe(ALASAN_TOLAK);
    },
    LAMBAT,
  );
});
