import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { decideSubmission } from "@/server/approval/workflow";
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

const PREFIX = "f20ac3-";
const PERIOD = uniquePeriod();

let coo: Awaited<ReturnType<typeof actorFrom>>;
let cfo: Awaited<ReturnType<typeof actorFrom>>;
let pm: Awaited<ReturnType<typeof actorFrom>>;
let financePoc: Awaited<ReturnType<typeof actorFrom>>;
let officer: Awaited<ReturnType<typeof actorFrom>>;
let projectDbId: string;
let terminDpId: string;
let terminPelunasanId: string;
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
      name: "Project Termin Lunas",
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
  terminDpId = termins[0].id;
  terminPelunasanId = termins[1].id;

  const invoice = await requestInvoice({
    actor: pm.actor,
    terminId: terminDpId,
  });
  if (!invoice.ok) throw new Error(`Invoice gagal: ${invoice.reason}`);

  const bukti = await recordTransferProof({
    actor: pm.actor,
    invoiceId: invoice.invoiceId,
    amount: "3000000",
    paidAt: new Date("2026-09-20T00:00:00.000Z"),
    proofUrl: "https://drive.google.com/file/d/bukti-dp-lunas/view",
  });
  if (!bukti.ok) throw new Error(`Bukti transfer gagal: ${bukti.reason}`);
  receiptId = bukti.receiptId;

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

describe("F20-AC3 Setelah proses selesai, termin berstatus lunas.", () => {
  it("Termin masih tertagih sebelum kuitansinya dinyatakan valid", async () => {
    const termin = await testDb.termin.findUniqueOrThrow({
      where: { id: terminDpId },
      select: { status: true },
    });

    expect(termin.status).toBe("UNPAID");
  });

  it("Termin menjadi lunas begitu kuitansinya dinyatakan valid", async () => {
    const hasil = await validateReceipt({
      actor: financePoc.actor,
      receiptId,
      now: new Date("2026-09-21T03:00:00.000Z"),
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.matches).toBe(true);
    expect(hasil.terminSequence).toBe(1);

    const termin = await testDb.termin.findUniqueOrThrow({
      where: { id: terminDpId },
      select: { status: true },
    });

    expect(termin.status).toBe("PAID");
  });

  it("Termin lain tidak ikut lunas", async () => {
    const termin = await testDb.termin.findUniqueOrThrow({
      where: { id: terminPelunasanId },
      select: { status: true },
    });

    expect(termin.status).toBe("UNPAID");
  });

  it("Pelunasannya meninggalkan jejak aktivitas tersendiri", async () => {
    const jejak = await testDb.auditLog.findFirst({
      where: {
        action: AUDIT_ACTIONS.TERMIN_MARKED_PAID,
        objectType: AUDIT_OBJECTS.TERMIN,
        objectId: terminDpId,
      },
      select: { actorId: true },
    });

    expect(jejak?.actorId).toBe(financePoc.userId);
  });

  it("Termin yang sudah lunas tidak bisa ditagihkan ulang lewat invoice baru", async () => {
    const hasil = await requestInvoice({
      actor: pm.actor,
      terminId: terminDpId,
    });

    expect(hasil.ok).toBe(false);
  });

  it("Skema termin tidak bisa disusun ulang setelah ada yang lunas", async () => {
    const hasil = await saveTerminScheme({
      actor: coo.actor,
      projectDbId,
      drafts: [
        { sequence: 1, percentage: "40", dueDate: "2026-10-01T00:00:00.000Z" },
        { sequence: 2, percentage: "60", dueDate: "2026-12-01T00:00:00.000Z" },
      ],
    });

    expect(hasil.ok).toBe(false);
  });
});

describe("F13-AC3 Status termin berubah menjadi lunas setelah proses kuitansi selesai.", () => {
  it("Termin yang kuitansinya sudah valid berstatus lunas", async () => {
    const termin = await testDb.termin.findUniqueOrThrow({
      where: { id: terminDpId },
      select: { status: true },
    });

    expect(termin.status).toBe("PAID");
  });

  it("Termin yang kuitansinya belum ada tetap tertagih", async () => {
    const termin = await testDb.termin.findUniqueOrThrow({
      where: { id: terminPelunasanId },
      select: { status: true },
    });

    expect(termin.status).toBe("UNPAID");
  });
});
