import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { decideSubmission } from "@/server/approval/workflow";
import { readProjectInvoices, requestInvoice } from "@/server/finance/invoice";
import { assignProjectManager } from "@/server/project/assignment";
import { registerProject } from "@/server/project/registration";
import { saveTerminScheme } from "@/server/project/termin";
import {
  actorFrom,
  testDb,
  uniqueEmail,
  uniquePeriod,
} from "../support/database";

const PREFIX = "f16-";
const PERIOD = uniquePeriod();

/** Selasa 1 September 2026 pukul 09.00 WIB. */
const DIAJUKAN = new Date("2026-09-01T09:00:00+07:00");

const NILAI_PROJECT = 10_000_000;

let coo: Awaited<ReturnType<typeof actorFrom>>;
let pm: Awaited<ReturnType<typeof actorFrom>>;
let financePoc: Awaited<ReturnType<typeof actorFrom>>;
let projectDbId: string;
let projectId: string;
let terminDp: string;
let terminPelunasan: string;

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
      name: "Project Invoice",
      clientName: "PT Contoh Sejahtera",
      period: PERIOD,
      value: NILAI_PROJECT,
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

describe("F16-AC2 Pengajuan masuk langkah approval pertama beserta stempel waktunya.", () => {
  it("Invoice termin pertama masuk langkah Finance POC dengan stempel waktu pengajuan", async () => {
    const hasil = await requestInvoice({
      actor: pm.actor,
      terminId: terminDp,
      description: "Uang muka pembangunan sistem",
      now: DIAJUKAN,
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;

    expect(hasil.currentStepOrder).toBe(1);

    const pengajuan = await testDb.submission.findUnique({
      where: { id: hasil.submissionId },
      select: {
        type: true,
        status: true,
        currentStepOrder: true,
        createdAt: true,
        steps: { orderBy: { order: "asc" }, select: { label: true } },
      },
    });

    expect(pengajuan?.type).toBe("INVOICE");
    expect(pengajuan?.status).toBe("PENDING");
    expect(pengajuan?.currentStepOrder).toBe(1);
    expect(pengajuan?.steps.map((step) => step.label)).toEqual([
      "Finance POC",
      "POC dokumentasi",
      "CFO atau Vice CFO",
    ]);
    expect(pengajuan?.createdAt).toBeInstanceOf(Date);
  });

  it("Barisnya menyimpan nomor, client, dan nominal yang diambil dari project dan termin", async () => {
    const daftar = await readProjectInvoices(pm.actor, projectDbId);

    expect(daftar.ok).toBe(true);
    if (!daftar.ok) return;

    const invoice = daftar.invoices.find((row) => row.terminSequence === 1);
    expect(invoice).toBeDefined();
    if (!invoice) return;

    expect(invoice.number).toBe(`#02-${projectId}`);
    expect(invoice.clientName).toBe("PT Contoh Sejahtera");
    expect(Number(invoice.amount)).toBe(3_000_000);
    expect(invoice.description).toBe("Uang muka pembangunan sistem");
    expect(invoice.notes).toBeNull();
    expect(invoice.issuedAt.toISOString()).toBe(DIAJUKAN.toISOString());
    expect(invoice.currentStepLabel).toBe("Finance POC");
  });

  it("Pengajuannya meninggalkan jejak aktivitas", async () => {
    const daftar = await readProjectInvoices(pm.actor, projectDbId);
    expect(daftar.ok).toBe(true);
    if (!daftar.ok) return;

    const invoice = daftar.invoices.find((row) => row.terminSequence === 1);
    if (!invoice) throw new Error("Invoice termin pertama tidak ditemukan.");

    const jejak = await testDb.auditLog.findFirst({
      where: {
        action: AUDIT_ACTIONS.INVOICE_REQUESTED,
        objectType: AUDIT_OBJECTS.INVOICE,
        objectId: invoice.id,
      },
      select: { actorId: true },
    });

    expect(jejak?.actorId).toBe(pm.userId);
  });

  it("Langkah berjalan berpindah setelah Finance POC memutuskan", async () => {
    const daftar = await readProjectInvoices(pm.actor, projectDbId);
    if (!daftar.ok) throw new Error(daftar.reason);
    const invoice = daftar.invoices.find((row) => row.terminSequence === 1);
    if (!invoice) throw new Error("Invoice termin pertama tidak ditemukan.");

    const keputusan = await decideSubmission({
      actor: financePoc.actor,
      submissionId: invoice.submissionId,
      decision: "APPROVED",
    });

    expect(keputusan.ok).toBe(true);
    if (!keputusan.ok) return;
    expect(keputusan.nextStepOrder).toBe(2);

    const sesudah = await readProjectInvoices(pm.actor, projectDbId);
    if (!sesudah.ok) throw new Error(sesudah.reason);
    expect(
      sesudah.invoices.find((row) => row.terminSequence === 1)
        ?.currentStepLabel,
    ).toBe("POC dokumentasi");
  });

  it("Termin lain tetap bisa diajukan sendiri", async () => {
    const hasil = await requestInvoice({
      actor: pm.actor,
      terminId: terminPelunasan,
      now: DIAJUKAN,
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(Number(hasil.amount)).toBe(7_000_000);
    expect(hasil.currentStepOrder).toBe(1);
  });

  it("PM yang tidak ditugaskan pada project ini tidak bisa mengajukan invoicenya", async () => {
    const lain = await actorFrom(
      uniqueEmail(`${PREFIX}pm-lain-`),
      "PROJECT_MANAGER",
      "OPERATIONAL",
    );

    const hasil = await requestInvoice({
      actor: lain.actor,
      terminId: terminDp,
      now: DIAJUKAN,
    });

    expect(hasil.ok).toBe(false);
  });
});
