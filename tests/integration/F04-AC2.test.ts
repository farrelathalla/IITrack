import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import type { StageDefinition } from "@/lib/project/stages";
import { assignProjectManager } from "@/server/project/assignment";
import { projectContextFor } from "@/server/project/context";
import { registerProject } from "@/server/project/registration";
import { changeProjectStage } from "@/server/project/stage";
import {
  actorFrom,
  testDb,
  uniqueEmail,
  uniquePeriod,
} from "../support/database";

const PREFIX = "f04-";
const PERIOD = uniquePeriod();

const CONTOH: readonly StageDefinition[] = [
  { key: "tahap_satu", order: 1, label: "Tahap Satu" },
  { key: "tahap_dua", order: 2, label: "Tahap Dua" },
];

/** Selasa 1 September 2026 pukul 09.00 WIB. */
const KONFIRMASI_CLIENT = new Date("2026-09-01T09:00:00+07:00");

let coo: Awaited<ReturnType<typeof actorFrom>>;
let pmA: Awaited<ReturnType<typeof actorFrom>>;
let pmB: Awaited<ReturnType<typeof actorFrom>>;
let bukanPm: Awaited<ReturnType<typeof actorFrom>>;
let projectId: string;

beforeAll(async () => {
  coo = await actorFrom(uniqueEmail(`${PREFIX}coo-`), "COO", "OPERATIONAL");
  pmA = await actorFrom(
    uniqueEmail(`${PREFIX}pma-`),
    "PROJECT_MANAGER",
    "OPERATIONAL",
  );
  pmB = await actorFrom(
    uniqueEmail(`${PREFIX}pmb-`),
    "PROJECT_MANAGER",
    "OPERATIONAL",
  );
  bukanPm = await actorFrom(
    uniqueEmail(`${PREFIX}fin-`),
    "FINANCE_POC",
    "FINANCE",
  );

  const hasil = await registerProject({
    actor: coo.actor,
    input: {
      name: "Project Untuk Penugasan",
      clientName: "PT Contoh",
      period: PERIOD,
    },
  });
  if (!hasil.registered) throw new Error(`Pendaftaran gagal: ${hasil.reason}`);
  projectId = hasil.id;
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe("F04-AC1 Sistem menstempel waktu konfirmasi client dan waktu penugasan PM, lalu menghitung selisihnya terhadap ambang enam jam kerja.", () => {
  it("UAT-OP-001, COO menugaskan PM dan kedua stempel waktunya tersimpan", async () => {
    // Penugasan pada Selasa pukul 13.00, empat jam kerja setelah konfirmasi.
    const hasil = await assignProjectManager({
      actor: coo.actor,
      projectDbId: projectId,
      pmUserId: pmA.userId,
      clientConfirmedAt: KONFIRMASI_CLIENT,
      now: new Date("2026-09-01T13:00:00+07:00"),
    });

    expect(hasil.assigned).toBe(true);
    if (!hasil.assigned) return;

    expect(hasil.sla?.workingMinutes).toBe(240);
    expect(hasil.sla?.withinThreshold).toBe(true);

    const project = await testDb.project.findUnique({
      where: { id: projectId },
    });
    expect(project?.clientConfirmedAt?.toISOString()).toBe(
      KONFIRMASI_CLIENT.toISOString(),
    );
    expect(project?.pmAssignedAt).toBeInstanceOf(Date);
    expect(project?.assignedPmId).toBe(pmA.userId);
  });

  it("Penugasan yang melewati enam jam kerja ditandai melanggar SLA", async () => {
    const lain = await registerProject({
      actor: coo.actor,
      input: {
        name: "Project Lambat",
        clientName: "PT Contoh",
        period: PERIOD,
      },
    });
    if (!lain.registered) throw new Error("Pendaftaran gagal");

    // Konfirmasi Selasa 09.00, penugasan Rabu 10.00 = 540 menit kerja.
    const hasil = await assignProjectManager({
      actor: coo.actor,
      projectDbId: lain.id,
      pmUserId: pmA.userId,
      clientConfirmedAt: KONFIRMASI_CLIENT,
      now: new Date("2026-09-02T10:00:00+07:00"),
    });

    expect(hasil.assigned).toBe(true);
    if (!hasil.assigned) return;
    expect(hasil.sla?.withinThreshold).toBe(false);
    expect(hasil.sla?.overdueMinutes).toBe(180);
  });

  it("Penugasan tercatat di jejak aktivitas beserta hasil pengukuran SLA-nya", async () => {
    const jejak = await testDb.auditLog.findFirst({
      where: {
        action: AUDIT_ACTIONS.PROJECT_PM_ASSIGNED,
        objectType: AUDIT_OBJECTS.PROJECT,
        objectId: projectId,
      },
    });

    expect(jejak).not.toBeNull();
    expect(jejak?.actorId).toBe(coo.userId);
    expect(jejak?.after).toMatchObject({
      assignedPmId: pmA.userId,
      slaMenitKerja: 240,
      slaTerpenuhi: true,
    });
  });

  it("Pengurus yang tidak sedang menjabat PM tidak bisa ditugaskan", async () => {
    const hasil = await assignProjectManager({
      actor: coo.actor,
      projectDbId: projectId,
      pmUserId: bukanPm.userId,
    });

    expect(hasil.assigned).toBe(false);
    if (hasil.assigned) return;
    expect(hasil.reason).toContain("Project Manager");
  });

  it("Jabatan tanpa wewenang tidak bisa menugaskan PM", async () => {
    const hasil = await assignProjectManager({
      actor: pmA.actor,
      projectDbId: projectId,
      pmUserId: pmB.userId,
    });

    expect(hasil.assigned).toBe(false);
  });
});

describe("F04-AC2 Penugasan masuk riwayat dan langsung memberi hak edit Operational kepada PM yang ditunjuk.", () => {
  it("UAT-RBAC-006, PM yang ditugaskan langsung memperoleh hak edit Operational tanpa pengaturan manual", async () => {
    const konteks = await projectContextFor(pmA.actor, projectId);

    expect(konteks.assignedDivisions).toContain("OPERATIONAL");
  });

  it("UAT-RBAC-001, PM lain tetap tidak memperoleh hak edit pada project itu", async () => {
    const konteks = await projectContextFor(pmB.actor, projectId);

    expect(konteks.assignedDivisions).toHaveLength(0);
  });

  it("PM yang ditugaskan bisa memindahkan tahap project itu", async () => {
    const hasil = await changeProjectStage({
      actor: pmA.actor,
      projectDbId: projectId,
      toStage: "tahap_satu",
      catalogue: CONTOH,
    });

    expect(hasil.changed).toBe(true);
  });

  it("PM yang tidak ditugaskan tidak bisa memindahkan tahap project itu", async () => {
    const hasil = await changeProjectStage({
      actor: pmB.actor,
      projectDbId: projectId,
      toStage: "tahap_dua",
      catalogue: CONTOH,
    });

    expect(hasil.changed).toBe(false);
  });

  it("Pemindahan penugasan memindahkan hak edit tanpa mengubah jabatan global", async () => {
    await assignProjectManager({
      actor: coo.actor,
      projectDbId: projectId,
      pmUserId: pmB.userId,
    });

    expect(
      (await projectContextFor(pmB.actor, projectId)).assignedDivisions,
    ).toContain("OPERATIONAL");
    expect(
      (await projectContextFor(pmA.actor, projectId)).assignedDivisions,
    ).toHaveLength(0);

    // Jabatan global PM A tidak berubah, ia tetap Project Manager.
    const jabatan = await testDb.roleAssignment.findFirst({
      where: { userId: pmA.userId },
    });
    expect(jabatan?.role).toBe("PROJECT_MANAGER");
  });

  it("Riwayat penugasan lama tidak dihapus, kedua penugasan tetap terbaca di jejak", async () => {
    const jejak = await testDb.auditLog.findMany({
      where: {
        action: AUDIT_ACTIONS.PROJECT_PM_ASSIGNED,
        objectId: projectId,
      },
      orderBy: { createdAt: "asc" },
    });

    expect(jejak.length).toBeGreaterThanOrEqual(2);
    expect(jejak[0].after).toMatchObject({ assignedPmId: pmA.userId });
    expect(jejak[jejak.length - 1].after).toMatchObject({
      assignedPmId: pmB.userId,
    });
  });
});
