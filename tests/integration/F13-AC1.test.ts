import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { assignProjectManager } from "@/server/project/assignment";
import { registerProject } from "@/server/project/registration";
import { saveTerminScheme } from "@/server/project/termin";
import {
  actorFrom,
  testDb,
  uniqueEmail,
  uniquePeriod,
} from "../support/database";

const PREFIX = "f13-";
const PERIOD = uniquePeriod();
const JATUH_TEMPO = new Date("2026-10-01T00:00:00.000Z");
const JATUH_TEMPO_DUA = new Date("2026-11-01T00:00:00.000Z");

let coo: Awaited<ReturnType<typeof actorFrom>>;
let pm: Awaited<ReturnType<typeof actorFrom>>;
let financePoc: Awaited<ReturnType<typeof actorFrom>>;
let projectId: string;

async function projectBaru(nama: string, value = 10_000_000) {
  const hasil = await registerProject({
    actor: coo.actor,
    input: {
      name: nama,
      clientName: "PT Contoh",
      period: PERIOD,
      value,
    },
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
  projectId = await projectBaru("Project Termin");
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe("F13-AC1 Termin memuat nomor, persentase atau nominal, dan jatuh tempo.", () => {
  it("UAT-TERM-001, skema sah tersimpan lengkap beserta status pembayaran", async () => {
    const hasil = await saveTerminScheme({
      actor: pm.actor,
      projectDbId: projectId,
      drafts: [
        { sequence: 1, percentage: "30", dueDate: JATUH_TEMPO },
        { sequence: 2, percentage: "70", dueDate: JATUH_TEMPO_DUA },
      ],
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.count).toBe(2);

    const baris = await testDb.termin.findMany({
      where: { projectId },
      orderBy: { sequence: "asc" },
    });
    expect(baris).toHaveLength(2);
    expect(baris[0].sequence).toBe(1);
    expect(baris[0].percentage.toString()).toBe("30");
    expect(baris[0].amount.toString()).toBe("3000000");
    expect(baris[0].dueDate.toISOString()).toBe(JATUH_TEMPO.toISOString());
    expect(baris[0].status).toBe("UNPAID");
    expect(baris[1].percentage.toString()).toBe("70");
  });

  it("Menyimpan ulang mengganti skema lama yang belum lunas", async () => {
    const hasil = await saveTerminScheme({
      actor: pm.actor,
      projectDbId: projectId,
      drafts: [
        { sequence: 1, percentage: "40", dueDate: JATUH_TEMPO },
        { sequence: 2, percentage: "30", dueDate: JATUH_TEMPO_DUA },
        {
          sequence: 3,
          percentage: "30",
          dueDate: new Date("2026-12-01T00:00:00.000Z"),
        },
      ],
    });

    expect(hasil.ok).toBe(true);

    const baris = await testDb.termin.findMany({
      where: { projectId },
      orderBy: { sequence: "asc" },
    });
    expect(baris.map((row) => row.percentage.toString())).toEqual([
      "40",
      "30",
      "30",
    ]);
  });

  it("Penyimpanan skema meninggalkan jejak aktivitas", async () => {
    const jejak = await testDb.auditLog.findMany({
      where: {
        objectType: AUDIT_OBJECTS.PROJECT,
        objectId: projectId,
        action: AUDIT_ACTIONS.TERMIN_SCHEME_SAVED,
      },
    });

    expect(jejak.length).toBeGreaterThanOrEqual(2);
    expect(jejak.every((entry) => entry.actorId === pm.userId)).toBe(true);
  });
});

describe("F13-AC2 Sistem menolak skema yang jumlah persentasenya bukan seratus.", () => {
  it("UAT-TERM-002, jumlah bukan 100 ditolak dan baris lama tidak berubah", async () => {
    const sebelum = await testDb.termin.count({ where: { projectId } });

    const hasil = await saveTerminScheme({
      actor: pm.actor,
      projectDbId: projectId,
      drafts: [
        { sequence: 1, percentage: "30", dueDate: JATUH_TEMPO },
        { sequence: 2, percentage: "60", dueDate: JATUH_TEMPO_DUA },
      ],
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.reason.split(" ").length).toBeGreaterThan(4);
    expect(hasil.reason).not.toMatch(/^[A-Z0-9_]+$/);

    expect(await testDb.termin.count({ where: { projectId } })).toBe(sebelum);
  });

  it("Basis data menolak skema yang jumlahnya bukan 100, bahkan ditulis langsung", async () => {
    const lain = await projectBaru("Project Trigger Total");

    await expect(
      testDb.termin.create({
        data: {
          projectId: lain,
          sequence: 1,
          percentage: "30",
          amount: "3000000",
          dueDate: JATUH_TEMPO,
          createdById: pm.userId,
        },
      }),
    ).rejects.toThrow();
  });
});

describe("F13-AC3 Sistem menolak termin pertama di luar rentang 25 sampai 50 persen.", () => {
  it("Uang muka di luar 25–50 ditolak aplikasi", async () => {
    const hasil = await saveTerminScheme({
      actor: pm.actor,
      projectDbId: projectId,
      drafts: [
        { sequence: 1, percentage: "20", dueDate: JATUH_TEMPO },
        { sequence: 2, percentage: "80", dueDate: JATUH_TEMPO_DUA },
      ],
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.reason).toMatch(/25|uang muka|IITBOOK/i);
  });

  it("Basis data menolak uang muka di luar rentang, bahkan ditulis langsung", async () => {
    const lain = await projectBaru("Project Trigger DP");

    await expect(
      testDb.termin.create({
        data: {
          projectId: lain,
          sequence: 1,
          percentage: "20",
          amount: "2000000",
          dueDate: JATUH_TEMPO,
          createdById: pm.userId,
        },
      }),
    ).rejects.toThrow();
  });
});

describe("F13 wewenang dan kunci skema", () => {
  it("PM yang bukan pelaksana project tidak bisa menyimpan skema", async () => {
    const pmLain = await actorFrom(
      uniqueEmail(`${PREFIX}pmlain-`),
      "PROJECT_MANAGER",
      "OPERATIONAL",
    );

    const hasil = await saveTerminScheme({
      actor: pmLain.actor,
      projectDbId: projectId,
      drafts: [
        { sequence: 1, percentage: "30", dueDate: JATUH_TEMPO },
        { sequence: 2, percentage: "70", dueDate: JATUH_TEMPO_DUA },
      ],
    });

    expect(hasil.ok).toBe(false);
  });

  it("Finance POC tidak bisa menyusun jadwal termin", async () => {
    const hasil = await saveTerminScheme({
      actor: financePoc.actor,
      projectDbId: projectId,
      drafts: [
        { sequence: 1, percentage: "30", dueDate: JATUH_TEMPO },
        { sequence: 2, percentage: "70", dueDate: JATUH_TEMPO_DUA },
      ],
    });

    expect(hasil.ok).toBe(false);
  });

  it("Skema tidak bisa diganti setelah ada termin lunas", async () => {
    const lain = await projectBaru("Project Sudah Lunas");
    const dibuat = await saveTerminScheme({
      actor: pm.actor,
      projectDbId: lain,
      drafts: [
        { sequence: 1, percentage: "30", dueDate: JATUH_TEMPO },
        { sequence: 2, percentage: "70", dueDate: JATUH_TEMPO_DUA },
      ],
    });
    if (!dibuat.ok) throw new Error("Penyimpanan awal gagal");

    await testDb.termin.updateMany({
      where: { projectId: lain, sequence: 1 },
      data: { status: "PAID" },
    });

    const hasil = await saveTerminScheme({
      actor: pm.actor,
      projectDbId: lain,
      drafts: [
        { sequence: 1, percentage: "40", dueDate: JATUH_TEMPO },
        { sequence: 2, percentage: "60", dueDate: JATUH_TEMPO_DUA },
      ],
    });

    expect(hasil.ok).toBe(false);

    const dp = await testDb.termin.findFirstOrThrow({
      where: { projectId: lain, sequence: 1 },
    });
    expect(dp.status).toBe("PAID");
    expect(dp.percentage.toString()).toBe("30");
  });
});
