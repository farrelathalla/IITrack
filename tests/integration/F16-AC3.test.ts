import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { decideSubmission } from "@/server/approval/workflow";
import { requestInvoice } from "@/server/finance/invoice";
import { assignProjectManager } from "@/server/project/assignment";
import { registerProject } from "@/server/project/registration";
import { saveTerminScheme } from "@/server/project/termin";
import {
  actorFrom,
  testDb,
  uniqueEmail,
  uniquePeriod,
} from "../support/database";

const PREFIX = "f16ac3-";
const PERIOD = uniquePeriod();

let coo: Awaited<ReturnType<typeof actorFrom>>;
let pm: Awaited<ReturnType<typeof actorFrom>>;
let financePoc: Awaited<ReturnType<typeof actorFrom>>;
let projectDbId: string;
let terminDp: string;
let terminPelunasan: string;
let terminLunas: string;

beforeAll(async () => {
  coo = await actorFrom(uniqueEmail(`${PREFIX}coo-`), "COO", "OPERATIONAL");
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
      name: "Project Invoice Ganda",
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

  const skema = await saveTerminScheme({
    actor: coo.actor,
    projectDbId,
    drafts: [
      { sequence: 1, percentage: "30", dueDate: "2026-10-01T00:00:00.000Z" },
      { sequence: 2, percentage: "40", dueDate: "2026-12-01T00:00:00.000Z" },
      { sequence: 3, percentage: "30", dueDate: "2027-02-01T00:00:00.000Z" },
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
  terminLunas = termins[2].id;
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe("F16-AC3 Termin yang sudah punya pengajuan aktif tidak bisa diajukan lagi, dan sistem menjelaskan alasannya.", () => {
  it("Pengajuan kedua pada termin yang sama ditolak dengan alasan yang menyebut langkah berjalan", async () => {
    const pertama = await requestInvoice({
      actor: pm.actor,
      terminId: terminDp,
    });
    expect(pertama.ok).toBe(true);

    const kedua = await requestInvoice({ actor: pm.actor, terminId: terminDp });

    expect(kedua.ok).toBe(false);
    if (kedua.ok) return;
    expect(kedua.reason).toContain("Termin 1");
    expect(kedua.reason).toContain("Finance POC");
  });

  it("Penolakan itu tidak meninggalkan invoice kedua di basis data", async () => {
    const jumlah = await testDb.invoice.count({
      where: { projectId: projectDbId, termin: { sequence: 1 } },
    });

    expect(jumlah).toBe(1);
  });

  it("Termin yang pengajuannya ditolak boleh diajukan ulang", async () => {
    const pengajuan = await requestInvoice({
      actor: pm.actor,
      terminId: terminPelunasan,
    });
    expect(pengajuan.ok).toBe(true);
    if (!pengajuan.ok) return;

    const ditolak = await decideSubmission({
      actor: financePoc.actor,
      submissionId: pengajuan.submissionId,
      decision: "REJECTED",
      reason: "Nominalnya belum sesuai kesepakatan terakhir.",
    });
    expect(ditolak.ok).toBe(true);

    const ulang = await requestInvoice({
      actor: pm.actor,
      terminId: terminPelunasan,
    });

    expect(ulang.ok).toBe(true);
  });

  it("Termin yang sudah lunas tidak bisa ditagihkan lagi", async () => {
    await testDb.termin.update({
      where: { id: terminLunas },
      data: { status: "PAID" },
    });

    const hasil = await requestInvoice({
      actor: pm.actor,
      terminId: terminLunas,
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.reason).toContain("sudah lunas");
  });
});
