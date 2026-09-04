import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import type { StageDefinition } from "@/lib/project/stages";
import { registerProject } from "@/server/project/registration";
import { changeProjectStage, readStageHistory } from "@/server/project/stage";
import {
  actorFrom,
  testDb,
  uniqueEmail,
  uniquePeriod,
} from "../support/database";

const PREFIX = "f09-";
const PERIOD = uniquePeriod();

const CONTOH: readonly StageDefinition[] = [
  { key: "tahap_satu", order: 1, label: "Tahap Satu" },
  { key: "tahap_dua", order: 2, label: "Tahap Dua" },
  { key: "tahap_tiga", order: 3, label: "Tahap Tiga" },
];

let coo: Awaited<ReturnType<typeof actorFrom>>;
let financePoc: Awaited<ReturnType<typeof actorFrom>>;
let projectId: string;

beforeAll(async () => {
  coo = await actorFrom(uniqueEmail(`${PREFIX}coo-`), "COO", "OPERATIONAL");
  financePoc = await actorFrom(
    uniqueEmail(`${PREFIX}fin-`),
    "FINANCE_POC",
    "FINANCE",
  );

  const hasil = await registerProject({
    actor: coo.actor,
    input: {
      name: "Project Untuk Stage",
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

describe("F09-AC2 Perubahan stage mencatat status lama, status baru, pelaku, dan waktu.", () => {
  it("UAT-STAGE-001, perpindahan pertama tercatat dengan status lama kosong", async () => {
    const hasil = await changeProjectStage({
      actor: coo.actor,
      projectDbId: projectId,
      toStage: "tahap_satu",
      catalogue: CONTOH,
    });

    expect(hasil.changed).toBe(true);

    const riwayat = await readStageHistory(projectId, CONTOH);
    expect(riwayat).toHaveLength(1);
    expect(riwayat[0].fromStage).toBeNull();
    expect(riwayat[0].toStage).toBe("tahap_satu");
    expect(riwayat[0].changedAt).toBeInstanceOf(Date);
  });

  it("Perpindahan berikutnya mencatat status lama, status baru, pelaku, dan waktunya", async () => {
    await changeProjectStage({
      actor: coo.actor,
      projectDbId: projectId,
      toStage: "tahap_dua",
      note: "Kontrak sudah ditandatangani.",
      catalogue: CONTOH,
    });

    const riwayat = await readStageHistory(projectId, CONTOH);
    expect(riwayat[0].fromStage).toBe("tahap_satu");
    expect(riwayat[0].toStage).toBe("tahap_dua");
    expect(riwayat[0].toLabel).toBe("Tahap Dua");
    expect(riwayat[0].changedBy).toContain(PREFIX);
    expect(riwayat[0].note).toBe("Kontrak sudah ditandatangani.");
  });

  it("Tahap berjalan pada project ikut berubah, bukan hanya riwayatnya", async () => {
    const project = await testDb.project.findUnique({
      where: { id: projectId },
    });
    expect(project?.stage).toBe("tahap_dua");
  });

  it("Perpindahan menulis jejak aktivitas beserta nilai lama dan barunya", async () => {
    const jejak = await testDb.auditLog.findFirst({
      where: {
        action: AUDIT_ACTIONS.PROJECT_STAGE_CHANGED,
        objectType: AUDIT_OBJECTS.PROJECT,
        objectId: projectId,
      },
      orderBy: { createdAt: "desc" },
    });

    expect(jejak).not.toBeNull();
    expect(jejak?.before).toEqual({ stage: "tahap_satu" });
    expect(jejak?.after).toEqual({ stage: "tahap_dua" });
  });

  it("Perpindahan ke tahap yang sama ditolak dan tidak menambah baris riwayat", async () => {
    const sebelum = (await readStageHistory(projectId, CONTOH)).length;

    const hasil = await changeProjectStage({
      actor: coo.actor,
      projectDbId: projectId,
      toStage: "tahap_dua",
      catalogue: CONTOH,
    });

    expect(hasil.changed).toBe(false);
    expect((await readStageHistory(projectId, CONTOH)).length).toBe(sebelum);
  });
});

describe("F09-AC3 Pengguna tanpa wewenang tidak bisa mengubah stage, dan riwayatnya tidak bisa dimanipulasi.", () => {
  it("UAT-STAGE-002, jabatan tanpa wewenang ditolak dan tahapnya tidak berubah", async () => {
    const sebelum = await testDb.project.findUnique({
      where: { id: projectId },
    });

    const hasil = await changeProjectStage({
      actor: financePoc.actor,
      projectDbId: projectId,
      toStage: "tahap_tiga",
      catalogue: CONTOH,
    });

    expect(hasil.changed).toBe(false);

    const sesudah = await testDb.project.findUnique({
      where: { id: projectId },
    });
    expect(sesudah?.stage).toBe(sebelum?.stage);
  });

  it("Penolakan tidak meninggalkan baris riwayat", async () => {
    const riwayat = await readStageHistory(projectId, CONTOH);
    expect(riwayat.every((entri) => entri.toStage !== "tahap_tiga")).toBe(true);
  });

  it("Baris riwayat tidak bisa diubah, ditolak basis data", async () => {
    const baris = await testDb.projectStageHistory.findFirst({
      where: { projectId },
    });
    if (!baris) throw new Error("Butuh satu baris riwayat");

    await expect(
      testDb.projectStageHistory.update({
        where: { id: baris.id },
        data: { toStage: "tahap_tiga" },
      }),
    ).rejects.toThrow();
  });

  it("Baris riwayat tidak bisa dihapus, ditolak basis data", async () => {
    const baris = await testDb.projectStageHistory.findFirst({
      where: { projectId },
    });
    if (!baris) throw new Error("Butuh satu baris riwayat");

    await expect(
      testDb.projectStageHistory.delete({ where: { id: baris.id } }),
    ).rejects.toThrow();
  });

  it("Project yang sudah punya riwayat tidak bisa dihapus, sehingga riwayatnya tidak bisa dihilangkan lewat pintu belakang", async () => {
    await expect(
      testDb.project.delete({ where: { id: projectId } }),
    ).rejects.toThrow();
  });
});
