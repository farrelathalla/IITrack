import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import type { StageDefinition } from "@/lib/project/stages";
import { decideSubmission } from "@/server/approval/workflow";
import { createClient } from "@/server/client/management";
import { readFinanceChain } from "@/server/finance/chain";
import { requestInvoice } from "@/server/finance/invoice";
import { recordTransferProof, validateReceipt } from "@/server/finance/receipt";
import { assignProjectManager } from "@/server/project/assignment";
import { assignMember } from "@/server/project/members";
import { readProjectRepository } from "@/server/project/references";
import { registerProject } from "@/server/project/registration";
import { changeProjectStage, readStageHistory } from "@/server/project/stage";
import { saveTerminScheme } from "@/server/project/termin";
import {
  fulfillStaffingRequest,
  requestStaffing,
} from "@/server/techdev/staffing";
import {
  actorFrom,
  RUN,
  testDb,
  uniqueEmail,
  uniquePeriod,
} from "../support/database";

/**
 * UAT-E2E-001 Regular Project Flow.
 *
 * Menjalankan alur project reguler dari pendaftaran sampai termin lunas, dalam
 * satu project yang sama, memakai proses yang sama dengan yang dipakai halaman.
 *
 * Langkah UAT yang belum bisa dijalankan otomatis, dan alasannya:
 *
 * - Langkah 1, pemastian akun oleh Authorized TechDev. Undangan akun (F01)
 *   belum dibangun; test ini membuat akunnya langsung.
 * - Langkah 5, 6, dan 10, pelengkapan scope dan pembuatan Charter serta MoU.
 *   Pembuat dokumen (F12) berprioritas Should Have dan belum dibangun.
 *
 * Sisanya dijalankan utuh. Setiap langkah memeriksa keadaan yang tertinggal,
 * bukan hanya bahwa pemanggilannya tidak melempar.
 */

const PREFIX = "e2e001-";
const PERIOD = uniquePeriod();
const LAMBAT = 30_000;

const CONTOH: readonly StageDefinition[] = [
  { key: "tahap_satu", label: "Tahap Satu", order: 1 },
  { key: "tahap_dua", label: "Tahap Dua", order: 2 },
];

const NILAI_PROJECT = 10_000_000;
const REPO = "https://github.com/inkubator-it/sistem-absensi";

/** Selasa 1 September 2026, jam kerja WIB. */
const CLIENT_KONFIRMASI = new Date("2026-09-01T02:00:00.000Z");
const PM_DITUGASKAN = new Date("2026-09-01T05:00:00.000Z");
const SDM_DIAJUKAN = new Date("2026-09-02T02:00:00.000Z");
const SDM_DITETAPKAN = new Date("2026-09-02T06:00:00.000Z");
const DIBAYAR = new Date("2026-10-01T03:00:00.000Z");

let coo: Awaited<ReturnType<typeof actorFrom>>;
let cfo: Awaited<ReturnType<typeof actorFrom>>;
let cto: Awaited<ReturnType<typeof actorFrom>>;
let officer: Awaited<ReturnType<typeof actorFrom>>;
let pm: Awaited<ReturnType<typeof actorFrom>>;
let financePoc: Awaited<ReturnType<typeof actorFrom>>;
let programmer: Awaited<ReturnType<typeof actorFrom>>;

let projectDbId: string;
let projectId: string;
let terminDp: string;
let invoiceDp: { invoiceId: string; submissionId: string; number: string };
let receiptDp: string;

async function chain() {
  const hasil = await readFinanceChain(pm.actor, projectDbId);
  if (!hasil.ok) throw new Error(hasil.reason);
  return hasil.chain;
}

beforeAll(async () => {
  // Langkah 1. Akun pengurus disiapkan langsung, karena undangan akun (F01)
  // belum dibangun.
  coo = await actorFrom(uniqueEmail(`${PREFIX}coo-`), "COO", "OPERATIONAL");
  cfo = await actorFrom(uniqueEmail(`${PREFIX}cfo-`), "CFO", "FINANCE");
  cto = await actorFrom(uniqueEmail(`${PREFIX}cto-`), "CTO", "TECHDEV");
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
  programmer = await actorFrom(
    uniqueEmail(`${PREFIX}dev-`),
    "TECHDEV_MEMBER",
    "TECHDEV",
  );
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe("UAT-E2E-001 Regular Project Flow", () => {
  it(
    "Langkah 3 dan 4, PM mendaftarkan project dan Project ID terbit",
    async () => {
      const client = await createClient({
        actor: coo.actor,
        draft: { name: `PT Contoh Sejahtera ${RUN}` },
      });
      if (!client.ok) throw new Error(client.reason);

      const hasil = await registerProject({
        actor: pm.actor,
        input: {
          name: "Sistem Absensi",
          clientName: `PT Contoh Sejahtera ${RUN}`,
          clientId: client.clientId,
          period: PERIOD,
          value: NILAI_PROJECT,
        },
        now: CLIENT_KONFIRMASI,
      });

      expect(hasil.registered).toBe(true);
      if (!hasil.registered) return;

      projectDbId = hasil.id;
      projectId = hasil.projectId;
      expect(projectId).toMatch(/^IIT-\d{4}-\d{3}$/);
    },
    LAMBAT,
  );

  it(
    "Langkah 2, COO menugaskan PM dan lamanya terukur terhadap ambang enam jam kerja",
    async () => {
      const hasil = await assignProjectManager({
        actor: coo.actor,
        projectDbId,
        pmUserId: pm.userId,
        clientConfirmedAt: CLIENT_KONFIRMASI,
        now: PM_DITUGASKAN,
      });

      expect(hasil.assigned).toBe(true);
      if (!hasil.assigned) return;
      expect(hasil.sla?.workingMinutes).toBe(180);
      expect(hasil.sla?.withinThreshold).toBe(true);
    },
    LAMBAT,
  );

  it(
    "Langkah 7, 8, dan 9, PM mengajukan programmer, CTO menetapkan dan menautkan repository",
    async () => {
      const permintaan = await requestStaffing({
        actor: pm.actor,
        projectDbId,
        roleNeeded: "Backend Developer",
        headcount: 1,
        neededBy: new Date("2026-09-15T00:00:00.000Z"),
        technicalNeeds: "Next.js, Prisma, PostgreSQL",
        deliverable: "API termin dan invoice siap diuji",
        now: SDM_DIAJUKAN,
      });
      if (!permintaan.ok) throw new Error(permintaan.reason);

      const penetapan = await fulfillStaffingRequest({
        actor: cto.actor,
        requestId: permintaan.requestId,
        memberUserIds: [programmer.userId],
        repositoryUrl: REPO,
        now: SDM_DITETAPKAN,
      });

      expect(penetapan.ok).toBe(true);
      if (!penetapan.ok) return;
      expect(penetapan.responseTime.workingMinutes).toBe(240);

      const repo = await readProjectRepository(projectDbId);
      expect(repo?.url).toContain("inkubator-it/sistem-absensi");
    },
    LAMBAT,
  );

  it(
    "Langkah 11, PM menyusun jadwal termin",
    async () => {
      // Finance POC ditugaskan lebih dulu supaya bisa memproses kuitansinya.
      const penugasan = await assignMember({
        actor: cfo.actor,
        projectDbId,
        userId: financePoc.userId,
        division: "FINANCE",
      });
      if (!penugasan.ok) throw new Error(penugasan.reason);

      const skema = await saveTerminScheme({
        actor: pm.actor,
        projectDbId,
        drafts: [
          {
            sequence: 1,
            percentage: "30",
            dueDate: "2026-10-01T00:00:00.000Z",
          },
          {
            sequence: 2,
            percentage: "70",
            dueDate: "2026-12-01T00:00:00.000Z",
          },
        ],
      });

      expect(skema.ok).toBe(true);
      if (!skema.ok) return;
      expect(skema.count).toBe(2);

      const termins = await testDb.termin.findMany({
        where: { projectId: projectDbId },
        orderBy: { sequence: "asc" },
        select: { id: true },
      });
      terminDp = termins[0].id;

      expect((await chain()).termins[0].state).toBe("BELUM_DITAGIHKAN");
    },
    LAMBAT,
  );

  it(
    "Langkah 12, PM mengajukan invoice uang muka",
    async () => {
      const hasil = await requestInvoice({
        actor: pm.actor,
        terminId: terminDp,
      });
      if (!hasil.ok) throw new Error(hasil.reason);
      invoiceDp = hasil;

      expect(hasil.number).toBe(`#02-${projectId}`);
      expect(Number(hasil.amount)).toBe(3_000_000);

      const rantai = await chain();
      expect(rantai.termins[0].state).toBe("MENUNGGU_PERSETUJUAN");
      expect(rantai.termins[0].invoice?.currentStepLabel).toBe("Finance POC");
    },
    LAMBAT,
  );

  it(
    "Langkah 13, rantai persetujuan dijalankan sampai CFO",
    async () => {
      const urutan = [
        { aktor: financePoc, langkahBerikutnya: 2 },
        { aktor: officer, langkahBerikutnya: 3 },
        { aktor: cfo, langkahBerikutnya: null },
      ];

      for (const { aktor, langkahBerikutnya } of urutan) {
        const keputusan = await decideSubmission({
          actor: aktor.actor,
          submissionId: invoiceDp.submissionId,
          decision: "APPROVED",
        });
        if (!keputusan.ok) throw new Error(keputusan.reason);
        expect(keputusan.nextStepOrder).toBe(langkahBerikutnya);
      }

      expect((await chain()).termins[0].state).toBe("MENUNGGU_PEMBAYARAN");
    },
    LAMBAT,
  );

  it(
    "Langkah 14, PM mengunggah bukti transfer",
    async () => {
      const hasil = await recordTransferProof({
        actor: pm.actor,
        invoiceId: invoiceDp.invoiceId,
        amount: "3000000",
        paidAt: DIBAYAR,
        proofUrl: "https://drive.google.com/file/d/bukti-e2e-dp/view",
        proofNote: "Transfer BCA a.n. PT Contoh Sejahtera",
      });
      if (!hasil.ok) throw new Error(hasil.reason);
      receiptDp = hasil.receiptId;

      expect(hasil.number).toBe(`#01-${projectId}`);
      expect(hasil.warning).toBeNull();
      expect((await chain()).termins[0].state).toBe("MENUNGGU_VERIFIKASI");
    },
    LAMBAT,
  );

  it(
    "Langkah 15 dan 16, Finance POC memproses kuitansi dan termin menjadi lunas",
    async () => {
      const hasil = await validateReceipt({
        actor: financePoc.actor,
        receiptId: receiptDp,
      });
      if (!hasil.ok) throw new Error(hasil.reason);

      expect(hasil.matches).toBe(true);
      expect(hasil.terminStatus).toBe("PAID");

      const rantai = await chain();
      expect(rantai.termins.map((row) => row.state)).toEqual([
        "LUNAS",
        "BELUM_DITAGIHKAN",
      ]);
      expect(rantai.inconsistencies).toEqual([]);
    },
    LAMBAT,
  );

  it(
    "Tahap project bisa dipindahkan PM yang ditugaskan, dan riwayatnya tercatat",
    async () => {
      const hasil = await changeProjectStage({
        actor: pm.actor,
        projectDbId,
        toStage: "tahap_satu",
        catalogue: CONTOH,
        note: "Uang muka diterima.",
      });

      expect(hasil.changed).toBe(true);

      const riwayat = await readStageHistory(projectDbId, CONTOH);
      expect(riwayat[0].toStage).toBe("tahap_satu");
      expect(riwayat[0].note).toBe("Uang muka diterima.");
    },
    LAMBAT,
  );

  it(
    "Project ID konsisten pada seluruh dokumen dan rujukan yang terbit",
    async () => {
      const rantai = await chain();
      const termin = rantai.termins[0];

      expect(rantai.projectId).toBe(projectId);
      expect(termin.invoice?.number).toBe(`#02-${projectId}`);
      expect(termin.receipt?.number).toBe(`#01-${projectId}`);

      const repo = await readProjectRepository(projectDbId);
      expect(repo).not.toBeNull();

      // Seluruhnya menempel pada satu baris project yang sama, bukan pada
      // salinan yang kebetulan bernomor sama.
      const jumlah = await testDb.project.count({
        where: { projectId, id: projectDbId },
      });
      expect(jumlah).toBe(1);
    },
    LAMBAT,
  );

  it(
    "Riwayatnya lengkap dari pendaftaran sampai pelunasan",
    async () => {
      const jejakProject = await testDb.auditLog.findMany({
        where: { objectType: AUDIT_OBJECTS.PROJECT, objectId: projectDbId },
        orderBy: { createdAt: "asc" },
        select: { action: true },
      });

      expect(jejakProject.map((row) => row.action)).toEqual([
        AUDIT_ACTIONS.PROJECT_CREATED,
        AUDIT_ACTIONS.PROJECT_PM_ASSIGNED,
        AUDIT_ACTIONS.PROJECT_MEMBER_ASSIGNED,
        AUDIT_ACTIONS.REFERENCE_ADDED,
        AUDIT_ACTIONS.PROJECT_MEMBER_ASSIGNED,
        AUDIT_ACTIONS.TERMIN_SCHEME_SAVED,
        AUDIT_ACTIONS.PROJECT_STAGE_CHANGED,
      ]);

      expect(
        (
          await testDb.auditLog.findMany({
            where: { objectId: invoiceDp.submissionId },
            orderBy: { createdAt: "asc" },
            select: { action: true },
          })
        ).map((row) => row.action),
      ).toEqual([
        AUDIT_ACTIONS.SUBMISSION_CREATED,
        AUDIT_ACTIONS.SUBMISSION_STEP_APPROVED,
        AUDIT_ACTIONS.SUBMISSION_STEP_APPROVED,
        AUDIT_ACTIONS.SUBMISSION_STEP_APPROVED,
      ]);

      expect(
        (
          await testDb.auditLog.findMany({
            where: { objectId: receiptDp },
            orderBy: { createdAt: "asc" },
            select: { action: true },
          })
        ).map((row) => row.action),
      ).toEqual([
        AUDIT_ACTIONS.RECEIPT_RECORDED,
        AUDIT_ACTIONS.RECEIPT_VALIDATED,
      ]);
    },
    LAMBAT,
  );
});
