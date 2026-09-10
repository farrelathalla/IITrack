import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import {
  decideSubmission,
  reviseSubmission,
  submitForApproval,
} from "@/server/approval/workflow";
import { assignProjectManager } from "@/server/project/assignment";
import { registerProject } from "@/server/project/registration";
import {
  actorFrom,
  testDb,
  uniqueEmail,
  uniquePeriod,
} from "../support/database";

const PREFIX = "f17-";
const PERIOD = uniquePeriod();

let coo: Awaited<ReturnType<typeof actorFrom>>;
let pm: Awaited<ReturnType<typeof actorFrom>>;
let financePoc: Awaited<ReturnType<typeof actorFrom>>;
let pocDokumentasi: Awaited<ReturnType<typeof actorFrom>>;
let cfo: Awaited<ReturnType<typeof actorFrom>>;
let cto: Awaited<ReturnType<typeof actorFrom>>;
let projectId: string;

async function projectBaru(nama: string) {
  const hasil = await registerProject({
    actor: coo.actor,
    input: { name: nama, clientName: "PT Contoh", period: PERIOD },
  });
  if (!hasil.registered) throw new Error(`Pendaftaran gagal: ${hasil.reason}`);

  await assignProjectManager({
    actor: coo.actor,
    projectDbId: hasil.id,
    pmUserId: pm.userId,
  });

  return hasil.id;
}

beforeAll(async () => {
  coo = await actorFrom(uniqueEmail(`${PREFIX}coo-`), "COO", "OPERATIONAL");
  pm = await actorFrom(
    uniqueEmail(`${PREFIX}pm-`),
    "PROJECT_MANAGER",
    "OPERATIONAL",
  );
  financePoc = await actorFrom(
    uniqueEmail(`${PREFIX}fin-`),
    "FINANCE_POC",
    "FINANCE",
  );
  pocDokumentasi = await actorFrom(
    uniqueEmail(`${PREFIX}doc-`),
    "OFFICER_OPERATIONAL",
    "OPERATIONAL",
  );
  cfo = await actorFrom(uniqueEmail(`${PREFIX}cfo-`), "CFO", "FINANCE");
  cto = await actorFrom(uniqueEmail(`${PREFIX}cto-`), "CTO", "TECHDEV");

  projectId = await projectBaru("Project Approval");
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe("F17-AC1 Sistem menentukan approver dari jenis pengajuan dan jabatan, jadi pengaju tidak memilihnya sendiri.", () => {
  it("UAT-APR-001, pengajuan invoice langsung memuat seluruh langkah rantainya", async () => {
    const hasil = await submitForApproval({
      actor: pm.actor,
      type: "INVOICE",
      projectDbId: projectId,
      payload: { termin: 1, nominal: 5_000_000 },
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;

    const langkah = await testDb.approvalStep.findMany({
      where: { submissionId: hasil.submissionId },
      orderBy: { order: "asc" },
    });

    expect(langkah).toHaveLength(3);
    expect(langkah.map((l) => l.label)).toEqual([
      "Finance POC",
      "POC dokumentasi",
      "CFO atau Vice CFO",
    ]);
    expect(langkah.every((l) => l.decision === "PENDING")).toBe(true);
    expect(hasil.currentStepOrder).toBe(1);
  });

  it("Pengaju tidak menyertakan approver, jabatan berwenang disalin sistem dari rantainya", async () => {
    const submission = await testDb.submission.findFirstOrThrow({
      where: { projectId, type: "INVOICE" },
      include: { steps: { orderBy: { order: "asc" } } },
    });

    expect(submission.steps[0].eligibleRoles).toEqual(["FINANCE_POC"]);
    expect(submission.steps[2].eligibleRoles).toEqual(["CFO", "VICE_CFO"]);
  });

  it("Yang bukan pelaksana project tidak bisa mengajukan", async () => {
    const pmLain = await actorFrom(
      uniqueEmail(`${PREFIX}pmlain-`),
      "PROJECT_MANAGER",
      "OPERATIONAL",
    );

    const hasil = await submitForApproval({
      actor: pmLain.actor,
      type: "INVOICE",
      projectDbId: projectId,
    });

    expect(hasil.ok).toBe(false);
  });
});

describe("F17-AC2 Setiap langkah mencatat approver, keputusan, alasan, dan waktu, lalu meneruskan ke langkah berikutnya.", () => {
  it("UAT-APR-002, persetujuan meneruskan ke langkah berikutnya dan mencatat pelakunya", async () => {
    const submission = await testDb.submission.findFirstOrThrow({
      where: { projectId, type: "INVOICE" },
    });

    const hasil = await decideSubmission({
      actor: financePoc.actor,
      submissionId: submission.id,
      decision: "APPROVED",
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.status).toBe("PENDING");
    expect(hasil.nextStepOrder).toBe(2);

    const langkah = await testDb.approvalStep.findFirstOrThrow({
      where: { submissionId: submission.id, order: 1, revision: 1 },
    });
    expect(langkah.decision).toBe("APPROVED");
    expect(langkah.decidedById).toBe(financePoc.userId);
    expect(langkah.decidedAt).toBeInstanceOf(Date);
  });

  it("Persetujuan pada langkah terakhir menyelesaikan pengajuan", async () => {
    const submission = await testDb.submission.findFirstOrThrow({
      where: { projectId, type: "INVOICE" },
    });

    await decideSubmission({
      actor: pocDokumentasi.actor,
      submissionId: submission.id,
      decision: "APPROVED",
    });

    const hasil = await decideSubmission({
      actor: cfo.actor,
      submissionId: submission.id,
      decision: "APPROVED",
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.status).toBe("APPROVED");
    expect(hasil.nextStepOrder).toBeNull();
  });

  it("Pengajuan yang sudah selesai tidak bisa diputuskan lagi", async () => {
    const submission = await testDb.submission.findFirstOrThrow({
      where: { projectId, type: "INVOICE" },
    });

    const hasil = await decideSubmission({
      actor: cfo.actor,
      submissionId: submission.id,
      decision: "APPROVED",
    });

    expect(hasil.ok).toBe(false);
  });

  it("Setiap keputusan meninggalkan jejak aktivitas", async () => {
    const submission = await testDb.submission.findFirstOrThrow({
      where: { projectId, type: "INVOICE" },
    });

    const jejak = await testDb.auditLog.findMany({
      where: {
        objectType: AUDIT_OBJECTS.SUBMISSION,
        objectId: submission.id,
        action: AUDIT_ACTIONS.SUBMISSION_STEP_APPROVED,
      },
    });

    expect(jejak).toHaveLength(3);
  });

  it("Keputusan yang sudah tercatat tidak bisa diubah, ditolak basis data", async () => {
    const submission = await testDb.submission.findFirstOrThrow({
      where: { projectId, type: "INVOICE" },
    });
    const langkah = await testDb.approvalStep.findFirstOrThrow({
      where: { submissionId: submission.id, order: 1, revision: 1 },
    });

    await expect(
      testDb.approvalStep.update({
        where: { id: langkah.id },
        data: { decision: "REJECTED", reason: "Diubah belakangan." },
      }),
    ).rejects.toThrow();
  });
});

describe("F17-AC3 Penolakan wajib mengisi alasan, dan pengajuan yang ditolak bisa diperbaiki tanpa kehilangan riwayat.", () => {
  it("UAT-APR-003, penolakan tanpa alasan ditolak dan langkahnya tetap menunggu", async () => {
    const lain = await projectBaru("Project Ditolak");
    const dibuat = await submitForApproval({
      actor: pm.actor,
      type: "INVOICE",
      projectDbId: lain,
    });
    if (!dibuat.ok) throw new Error("Pengajuan gagal");

    const hasil = await decideSubmission({
      actor: financePoc.actor,
      submissionId: dibuat.submissionId,
      decision: "REJECTED",
    });

    expect(hasil.ok).toBe(false);

    const langkah = await testDb.approvalStep.findFirstOrThrow({
      where: { submissionId: dibuat.submissionId, order: 1 },
    });
    expect(langkah.decision).toBe("PENDING");
  });

  it("Penolakan beralasan menghentikan pengajuan dan alasannya tersimpan", async () => {
    const submission = await testDb.submission.findFirstOrThrow({
      where: { type: "INVOICE", status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    const hasil = await decideSubmission({
      actor: financePoc.actor,
      submissionId: submission.id,
      decision: "REJECTED",
      reason: "Nominalnya tidak cocok dengan termin yang disepakati.",
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.status).toBe("REJECTED");

    const langkah = await testDb.approvalStep.findFirstOrThrow({
      where: { submissionId: submission.id, order: 1, revision: 1 },
    });
    expect(langkah.reason).toContain("tidak cocok");
  });

  it("UAT-APR-004, perbaikan membuka revisi baru tanpa menghapus riwayat penolakan", async () => {
    const submission = await testDb.submission.findFirstOrThrow({
      where: { type: "INVOICE", status: "REJECTED" },
      orderBy: { createdAt: "desc" },
    });

    const hasil = await reviseSubmission({
      actor: pm.actor,
      submissionId: submission.id,
      payload: { termin: 1, nominal: 4_000_000 },
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.revision).toBe(2);

    const revisiLama = await testDb.approvalStep.findFirstOrThrow({
      where: { submissionId: submission.id, revision: 1, order: 1 },
    });
    expect(revisiLama.decision).toBe("REJECTED");
    expect(revisiLama.reason).toContain("tidak cocok");

    const revisiBaru = await testDb.approvalStep.findMany({
      where: { submissionId: submission.id, revision: 2 },
    });
    expect(revisiBaru).toHaveLength(3);
    expect(revisiBaru.every((l) => l.decision === "PENDING")).toBe(true);

    const diperbarui = await testDb.submission.findUniqueOrThrow({
      where: { id: submission.id },
    });
    expect(diperbarui.status).toBe("PENDING");
    expect(diperbarui.currentStepOrder).toBe(1);
  });

  it("Pengajuan yang belum ditolak tidak bisa diperbaiki", async () => {
    const submission = await testDb.submission.findFirstOrThrow({
      where: { type: "INVOICE", status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    const hasil = await reviseSubmission({
      actor: pm.actor,
      submissionId: submission.id,
    });

    expect(hasil.ok).toBe(false);
  });
});

describe("F17-AC4 Pengguna tanpa wewenang tidak bisa menyetujui, baik lewat tampilan maupun lewat permintaan langsung ke server.", () => {
  it("UAT-RBAC-002, PM tidak bisa menyetujui langkah Finance walau ia yang mengajukan", async () => {
    const lain = await projectBaru("Project Tanpa Wewenang");
    const dibuat = await submitForApproval({
      actor: pm.actor,
      type: "INVOICE",
      projectDbId: lain,
    });
    if (!dibuat.ok) throw new Error("Pengajuan gagal");

    const hasil = await decideSubmission({
      actor: pm.actor,
      submissionId: dibuat.submissionId,
      decision: "APPROVED",
    });

    expect(hasil.ok).toBe(false);

    const langkah = await testDb.approvalStep.findFirstOrThrow({
      where: { submissionId: dibuat.submissionId, order: 1 },
    });
    expect(langkah.decision).toBe("PENDING");
  });

  it("CTO tidak bisa menyetujui langkah Finance, walau ia C-Level di divisi lain", async () => {
    const submission = await testDb.submission.findFirstOrThrow({
      where: { type: "INVOICE", status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    const hasil = await decideSubmission({
      actor: cto.actor,
      submissionId: submission.id,
      decision: "APPROVED",
    });

    expect(hasil.ok).toBe(false);
  });

  it("CFO tidak bisa menyetujui langkah pertama, karena bukan gilirannya", async () => {
    const submission = await testDb.submission.findFirstOrThrow({
      where: { type: "INVOICE", status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    const hasil = await decideSubmission({
      actor: cfo.actor,
      submissionId: submission.id,
      decision: "APPROVED",
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.reason).toContain("Finance POC");
  });

  it("Penolakan menyebutkan langkah yang sedang menunggu, dalam bahasa pengguna", async () => {
    const submission = await testDb.submission.findFirstOrThrow({
      where: { type: "INVOICE", status: "PENDING" },
      orderBy: { createdAt: "desc" },
    });

    const hasil = await decideSubmission({
      actor: cto.actor,
      submissionId: submission.id,
      decision: "APPROVED",
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.reason.split(" ").length).toBeGreaterThan(4);
    expect(hasil.reason).not.toMatch(/^[A-Z0-9_]+$/);
  });
});
