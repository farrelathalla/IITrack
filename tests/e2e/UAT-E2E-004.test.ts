import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import type { StageDefinition } from "@/lib/project/stages";
import { decideSubmission } from "@/server/approval/workflow";
import { createClient } from "@/server/client/management";
import { requestInvoice } from "@/server/finance/invoice";
import { recordTransferProof, validateReceipt } from "@/server/finance/receipt";
import { assignRole } from "@/server/member/management";
import { assignProjectManager } from "@/server/project/assignment";
import { assignMember } from "@/server/project/members";
import { registerProject } from "@/server/project/registration";
import { changeProjectStage, readStageHistory } from "@/server/project/stage";
import { saveTerminScheme } from "@/server/project/termin";
import {
  actorFrom,
  RUN,
  testDb,
  uniqueEmail,
  uniquePeriod,
} from "../support/database";

/**
 * UAT-E2E-004 Unauthorized User Scenario.
 *
 * Menjalankan percobaan yang seharusnya gagal, memakai proses yang sama dengan
 * yang dipakai halaman. Yang diuji bukan tombolnya hilang, melainkan
 * permintaan langsung ke server tetap ditolak (F03-AC2), dan yang ditolak
 * tidak meninggalkan perubahan apa pun.
 *
 * PM di sini adalah PM yang memang ditugaskan pada projectnya. Itu disengaja:
 * penolakan yang diuji harus lahir dari batas wewenang jabatan, bukan sekadar
 * dari ketiadaan penugasan. Batas yang kedua diuji terpisah pada langkah
 * terakhir memakai PM lain yang bukan pelaksana.
 *
 * Setiap penolakan diperiksa dua kali: prosesnya menolak, dan keadaan yang
 * ditinggalkannya tidak berubah. Penolakan yang diam-diam sudah menulis
 * separuh data akan lolos bila hanya nilai kembaliannya yang diperiksa.
 */

const PREFIX = "e2e004-";
const PERIOD = uniquePeriod();
const LAMBAT = 30_000;

const CONTOH: readonly StageDefinition[] = [
  { key: "tahap_satu", label: "Tahap Satu", order: 1 },
  { key: "tahap_dua", label: "Tahap Dua", order: 2 },
];

const NILAI_PROJECT = 20_000_000;
const NILAI_DP = 6_000_000;

/** Selasa 1 September 2026, jam kerja WIB. */
const CLIENT_KONFIRMASI = new Date("2026-09-01T02:00:00.000Z");
const PM_DITUGASKAN = new Date("2026-09-01T05:00:00.000Z");
const DIBAYAR = new Date("2026-10-01T03:00:00.000Z");

let coo: Awaited<ReturnType<typeof actorFrom>>;
let cfo: Awaited<ReturnType<typeof actorFrom>>;
let officer: Awaited<ReturnType<typeof actorFrom>>;
let financePoc: Awaited<ReturnType<typeof actorFrom>>;
let pm: Awaited<ReturnType<typeof actorFrom>>;
let pmLain: Awaited<ReturnType<typeof actorFrom>>;

/** Pengurus tanpa jabatan, dipakai sebagai sasaran percobaan kelola jabatan. */
let kandidatId: string;

let projectDbId: string;
let projectId: string;
let terminDp: string;
let invoiceDp: { invoiceId: string; submissionId: string };
let receiptDp: string;

/** Langkah persetujuan yang sedang menunggu keputusan pada pengajuan invoice. */
async function langkahBerjalan() {
  const submission = await testDb.submission.findUnique({
    where: { id: invoiceDp.submissionId },
    select: { status: true, currentStepOrder: true },
  });
  if (!submission) throw new Error("Pengajuan invoice tidak ditemukan.");
  return submission;
}

beforeAll(async () => {
  coo = await actorFrom(uniqueEmail(`${PREFIX}coo-`), "COO", "OPERATIONAL");
  cfo = await actorFrom(uniqueEmail(`${PREFIX}cfo-`), "CFO", "FINANCE");
  officer = await actorFrom(
    uniqueEmail(`${PREFIX}officer-`),
    "OFFICER_OPERATIONAL",
    "OPERATIONAL",
  );
  financePoc = await actorFrom(
    uniqueEmail(`${PREFIX}poc-`),
    "FINANCE_POC",
    "FINANCE",
  );
  pm = await actorFrom(
    uniqueEmail(`${PREFIX}pm-`),
    "PROJECT_MANAGER",
    "OPERATIONAL",
  );
  pmLain = await actorFrom(
    uniqueEmail(`${PREFIX}pm-lain-`),
    "PROJECT_MANAGER",
    "OPERATIONAL",
  );

  const kandidat = await testDb.user.create({
    data: {
      email: uniqueEmail(`${PREFIX}kandidat-`),
      name: "Kandidat Tanpa Jabatan",
      status: "ACTIVE",
    },
    select: { id: true },
  });
  kandidatId = kandidat.id;

  // Project dibawa sampai persis sebelum langkah persetujuan terakhir, supaya
  // percobaan PM pada langkah 2 benar-benar mengenai langkah final yang sedang
  // menunggu, bukan langkah yang sudah lewat.
  const client = await createClient({
    actor: coo.actor,
    draft: { name: `PT Uji Wewenang ${RUN}` },
  });
  if (!client.ok) throw new Error(client.reason);

  const project = await registerProject({
    actor: pm.actor,
    input: {
      name: "Portal Alumni",
      clientName: `PT Uji Wewenang ${RUN}`,
      clientId: client.clientId,
      period: PERIOD,
      value: NILAI_PROJECT,
    },
    now: CLIENT_KONFIRMASI,
  });
  if (!project.registered) throw new Error(project.reason);
  projectDbId = project.id;
  projectId = project.projectId;

  const penugasanPm = await assignProjectManager({
    actor: coo.actor,
    projectDbId,
    pmUserId: pm.userId,
    clientConfirmedAt: CLIENT_KONFIRMASI,
    now: PM_DITUGASKAN,
  });
  if (!penugasanPm.assigned) throw new Error(penugasanPm.reason);

  const penugasanPoc = await assignMember({
    actor: cfo.actor,
    projectDbId,
    userId: financePoc.userId,
    division: "FINANCE",
  });
  if (!penugasanPoc.ok) throw new Error(penugasanPoc.reason);

  const skema = await saveTerminScheme({
    actor: pm.actor,
    projectDbId,
    drafts: [
      { sequence: 1, percentage: "30", dueDate: "2026-10-01T00:00:00.000Z" },
      { sequence: 2, percentage: "70", dueDate: "2026-12-01T00:00:00.000Z" },
    ],
  });
  if (!skema.ok) throw new Error(skema.reason);

  const termins = await testDb.termin.findMany({
    where: { projectId: projectDbId },
    orderBy: { sequence: "asc" },
    select: { id: true },
  });
  terminDp = termins[0].id;

  const invoice = await requestInvoice({ actor: pm.actor, terminId: terminDp });
  if (!invoice.ok) throw new Error(invoice.reason);
  invoiceDp = {
    invoiceId: invoice.invoiceId,
    submissionId: invoice.submissionId,
  };

  // Finance POC lalu POC dokumentasi menyelesaikan langkahnya, sehingga yang
  // tersisa adalah langkah CFO.
  for (const aktor of [financePoc, officer]) {
    const keputusan = await decideSubmission({
      actor: aktor.actor,
      submissionId: invoiceDp.submissionId,
      decision: "APPROVED",
    });
    if (!keputusan.ok) throw new Error(keputusan.reason);
  }
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe("UAT-E2E-004 Unauthorized User Scenario", () => {
  it(
    "Langkah 2, PM tidak bisa memutuskan langkah persetujuan terakhir invoice",
    async () => {
      const sebelum = await langkahBerjalan();
      expect(sebelum.status).toBe("PENDING");
      expect(sebelum.currentStepOrder).toBe(3);

      const hasil = await decideSubmission({
        actor: pm.actor,
        submissionId: invoiceDp.submissionId,
        decision: "APPROVED",
      });

      expect(hasil.ok).toBe(false);
      if (hasil.ok) return;
      expect(hasil.reason).toContain("CFO atau Vice CFO");

      // Pengajuannya tidak bergerak, dan langkahnya belum diputuskan siapa pun.
      const sesudah = await langkahBerjalan();
      expect(sesudah.status).toBe("PENDING");
      expect(sesudah.currentStepOrder).toBe(3);

      const langkah = await testDb.approvalStep.findMany({
        where: { submissionId: invoiceDp.submissionId, order: 3 },
        select: { decision: true, decidedById: true, decidedAt: true },
      });
      expect(langkah).toHaveLength(1);
      expect(langkah[0].decision).toBe("PENDING");
      expect(langkah[0].decidedById).toBeNull();
      expect(langkah[0].decidedAt).toBeNull();
    },
    LAMBAT,
  );

  it(
    "Langkah 3, PM tidak bisa menetapkan jabatan pengurus lain",
    async () => {
      const hasil = await assignRole({
        actor: pm.actor,
        userId: kandidatId,
        role: "FINANCE_POC",
        division: "FINANCE",
        period: "2026/2027",
        startDate: new Date("2026-09-01T00:00:00.000Z"),
        endDate: null,
      });

      expect(hasil.ok).toBe(false);
      if (hasil.ok) return;
      expect(hasil.reason).toContain("tidak memiliki wewenang");

      // Kandidatnya tetap tanpa jabatan, jadi tidak ada kewenangan yang terbit.
      const jabatan = await testDb.roleAssignment.findMany({
        where: { userId: kandidatId },
      });
      expect(jabatan).toEqual([]);
    },
    LAMBAT,
  );

  it(
    "Sebagai pengaju, PM tetap boleh mencatat bukti transfer setelah CFO menyetujui",
    async () => {
      const final = await decideSubmission({
        actor: cfo.actor,
        submissionId: invoiceDp.submissionId,
        decision: "APPROVED",
      });
      if (!final.ok) throw new Error(final.reason);
      expect(final.status).toBe("APPROVED");

      const bukti = await recordTransferProof({
        actor: pm.actor,
        invoiceId: invoiceDp.invoiceId,
        amount: String(NILAI_DP),
        paidAt: DIBAYAR,
        proofUrl: "https://drive.google.com/file/d/bukti-e2e-004/view",
        proofNote: "Transfer BCA a.n. PT Uji Wewenang",
      });
      if (!bukti.ok) throw new Error(bukti.reason);
      receiptDp = bukti.receiptId;

      // Penolakan pada langkah lain memang batas wewenang, bukan penolakan
      // menyeluruh terhadap PM.
      expect(bukti.number).toBe(`#01-${projectId}`);
    },
    LAMBAT,
  );

  it(
    "Langkah 4, PM tidak bisa memvalidasi kuitansi yang menjadi wewenang Finance",
    async () => {
      const hasil = await validateReceipt({
        actor: pm.actor,
        receiptId: receiptDp,
      });

      expect(hasil.ok).toBe(false);
      if (hasil.ok) return;
      expect(hasil.reason).toContain("tidak memiliki wewenang");

      // Kuitansinya belum valid, dan terminnya belum ikut dinyatakan lunas.
      const kuitansi = await testDb.receipt.findUnique({
        where: { id: receiptDp },
        select: { status: true, validatedById: true, validatedAt: true },
      });
      expect(kuitansi?.status).toBe("RECORDED");
      expect(kuitansi?.validatedById).toBeNull();
      expect(kuitansi?.validatedAt).toBeNull();

      const termin = await testDb.termin.findUnique({
        where: { id: terminDp },
        select: { status: true },
      });
      expect(termin?.status).toBe("UNPAID");
    },
    LAMBAT,
  );

  it(
    "PM yang tidak ditugaskan tidak bisa mengubah tahap maupun termin project",
    async () => {
      const tahap = await changeProjectStage({
        actor: pmLain.actor,
        projectDbId,
        toStage: "tahap_satu",
        catalogue: CONTOH,
        note: "Percobaan tanpa penugasan.",
      });

      expect(tahap.changed).toBe(false);
      if (tahap.changed) return;
      expect(tahap.reason).toContain("bukan pelaksana yang ditugaskan");

      const termin = await saveTerminScheme({
        actor: pmLain.actor,
        projectDbId,
        drafts: [
          {
            sequence: 1,
            percentage: "50",
            dueDate: "2026-10-01T00:00:00.000Z",
          },
          {
            sequence: 2,
            percentage: "50",
            dueDate: "2026-12-01T00:00:00.000Z",
          },
        ],
      });

      expect(termin.ok).toBe(false);

      // Tahapnya tidak berpindah dan skema terminnya tidak tertimpa.
      expect(await readStageHistory(projectDbId, CONTOH)).toEqual([]);

      const persentase = await testDb.termin.findMany({
        where: { projectId: projectDbId },
        orderBy: { sequence: "asc" },
        select: { percentage: true },
      });
      expect(persentase.map((row) => row.percentage.toString())).toEqual([
        "30",
        "70",
      ]);
    },
    LAMBAT,
  );

  it(
    "Tidak ada percobaan yang ditolak meninggalkan jejak aktivitas",
    async () => {
      // Jejak hanya ditulis oleh aksi yang berhasil. Bila salah satu penolakan
      // di atas ternyata sempat menulis sebagian datanya, aksinya akan muncul
      // di sini atas nama pelakunya.
      const jejakPm = await testDb.auditLog.findMany({
        where: { actorId: pm.userId },
        orderBy: { createdAt: "asc" },
        select: { action: true },
      });

      expect(jejakPm.map((row) => row.action)).toEqual([
        AUDIT_ACTIONS.PROJECT_CREATED,
        AUDIT_ACTIONS.TERMIN_SCHEME_SAVED,
        AUDIT_ACTIONS.SUBMISSION_CREATED,
        AUDIT_ACTIONS.INVOICE_REQUESTED,
        AUDIT_ACTIONS.RECEIPT_RECORDED,
      ]);

      // PM lain tidak pernah berhasil melakukan apa pun.
      expect(
        await testDb.auditLog.count({ where: { actorId: pmLain.userId } }),
      ).toBe(0);

      // Langkah terakhir invoice diputuskan CFO, bukan PM.
      const persetujuan = await testDb.auditLog.findMany({
        where: {
          objectType: AUDIT_OBJECTS.SUBMISSION,
          objectId: invoiceDp.submissionId,
          action: AUDIT_ACTIONS.SUBMISSION_STEP_APPROVED,
        },
        orderBy: { createdAt: "asc" },
        select: { actorId: true },
      });
      expect(persetujuan.map((row) => row.actorId)).toEqual([
        financePoc.userId,
        officer.userId,
        cfo.userId,
      ]);

      // Kuitansinya hanya punya jejak pencatatan, tanpa jejak validasi.
      const jejakKuitansi = await testDb.auditLog.findMany({
        where: { objectType: AUDIT_OBJECTS.RECEIPT, objectId: receiptDp },
        select: { action: true },
      });
      expect(jejakKuitansi.map((row) => row.action)).toEqual([
        AUDIT_ACTIONS.RECEIPT_RECORDED,
      ]);
    },
    LAMBAT,
  );
});
