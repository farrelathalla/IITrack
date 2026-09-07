import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import type { StageDefinition } from "@/lib/project/stages";
import { createClient, updateClient } from "@/server/client/management";
import { assignProjectManager } from "@/server/project/assignment";
import { projectContextFor } from "@/server/project/context";
import { registerProject } from "@/server/project/registration";
import { changeProjectStage, readStageHistory } from "@/server/project/stage";
import {
  actorFrom,
  RUN,
  testDb,
  uniqueEmail,
  uniquePeriod,
} from "../support/database";

const PREFIX = "xc01-";
const PERIOD = uniquePeriod();
const LAMBAT = 20_000;

/**
 * Nama client dibedakan per eksekusi.
 *
 * Master data client menolak nama kembar, dan basis data pengembangan lokal
 * tidak dikosongkan antar eksekusi. Tanpa penanda ini, penggantian nama pada
 * eksekusi sebelumnya membuat eksekusi berikutnya ditolak.
 */
const CLIENT_AWAL = `PT Contoh Sejahtera ${RUN}`;
const CLIENT_BARU = `PT Contoh Sejahtera Abadi ${RUN}`;

/**
 * Katalog tahap contoh.
 *
 * Daftar sebelas tahap resmi masih ditunggu lewat DEP-04, jadi test ini memakai
 * katalog sendiri supaya tidak ikut berubah saat daftar resminya turun.
 */
const CONTOH: readonly StageDefinition[] = [
  { key: "tahap_satu", label: "Tahap Satu", order: 1 },
  { key: "tahap_dua", label: "Tahap Dua", order: 2 },
];

let coo: Awaited<ReturnType<typeof actorFrom>>;
let pmA: Awaited<ReturnType<typeof actorFrom>>;
let pmB: Awaited<ReturnType<typeof actorFrom>>;
let clientId: string;
let projectDbId: string;
let projectId: string;

/** Waktu client mengonfirmasi, titik awal pengukuran SLA penugasan PM. */
const DIKONFIRMASI = new Date("2026-09-01T02:00:00.000Z");
const DITUGASKAN = new Date("2026-09-01T05:00:00.000Z");

beforeAll(async () => {
  coo = await actorFrom(uniqueEmail(`${PREFIX}coo-`), "COO", "OPERATIONAL");
  pmA = await actorFrom(
    uniqueEmail(`${PREFIX}pm-a-`),
    "PROJECT_MANAGER",
    "OPERATIONAL",
  );
  pmB = await actorFrom(
    uniqueEmail(`${PREFIX}pm-b-`),
    "PROJECT_MANAGER",
    "OPERATIONAL",
  );
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe("XC-01-AC1 One vertical slice creates a project, assigns a PM, changes stage, and produces consistent audit entries.", () => {
  it(
    "Client dicatat sekali sebagai master data",
    async () => {
      const hasil = await createClient({
        actor: coo.actor,
        draft: {
          name: CLIENT_AWAL,
          contact: "finance@contoh.test",
          address: "Jalan Ganesha 10, Bandung",
        },
      });

      expect(hasil.ok).toBe(true);
      if (!hasil.ok) return;
      clientId = hasil.clientId;
    },
    LAMBAT,
  );

  it(
    "Project baru terbit nomornya dan menempel pada client itu",
    async () => {
      const hasil = await registerProject({
        actor: coo.actor,
        input: {
          name: "Sistem Absensi",
          clientName: CLIENT_AWAL,
          clientId,
          period: PERIOD,
          value: 10_000_000,
        },
        now: DIKONFIRMASI,
      });

      expect(hasil.registered).toBe(true);
      if (!hasil.registered) return;

      projectDbId = hasil.id;
      projectId = hasil.projectId;
      expect(projectId).toMatch(/^IIT-\d{4}-\d{3}$/);

      const tersimpan = await testDb.project.findUniqueOrThrow({
        where: { id: projectDbId },
        select: { clientId: true, clientName: true, stage: true },
      });

      expect(tersimpan.clientId).toBe(clientId);
      expect(tersimpan.clientName).toBe(CLIENT_AWAL);
      expect(tersimpan.stage).toBeNull();
    },
    LAMBAT,
  );

  it(
    "Nama client yang diperbarui ikut terbawa ke project yang sudah berjalan",
    async () => {
      const hasil = await updateClient({
        actor: coo.actor,
        clientId,
        draft: {
          name: CLIENT_BARU,
          contact: "finance@contoh.test",
          address: "Jalan Ganesha 10, Bandung",
        },
      });
      expect(hasil.ok).toBe(true);

      const project = await testDb.project.findUniqueOrThrow({
        where: { id: projectDbId },
        select: { clientName: true, clientId: true },
      });

      expect(project.clientId).toBe(clientId);
      expect(project.clientName).toBe(CLIENT_BARU);

      // Versi lama tetap tersimpan, jadi rujukan lama tidak hilang.
      const revisi = await testDb.clientRevision.count({ where: { clientId } });
      expect(revisi).toBeGreaterThanOrEqual(2);
    },
    LAMBAT,
  );

  it(
    "Penugasan PM memberi hak edit Operational tanpa pengaturan izin manual",
    async () => {
      const hasil = await assignProjectManager({
        actor: coo.actor,
        projectDbId,
        pmUserId: pmA.userId,
        clientConfirmedAt: DIKONFIRMASI,
        now: DITUGASKAN,
      });
      expect(hasil.assigned).toBe(true);

      expect(
        (await projectContextFor(pmA.actor, projectDbId)).assignedDivisions,
      ).toContain("OPERATIONAL");
      expect(
        (await projectContextFor(pmB.actor, projectDbId)).assignedDivisions,
      ).toHaveLength(0);
    },
    LAMBAT,
  );

  it(
    "PM yang ditugaskan memindahkan tahap, tanpa pemanggil menyebutkan divisinya",
    async () => {
      // Divisi pelaksana tidak dikirim sebagai parameter. Kalau prosesnya masih
      // menerima dari pemanggil, PM yang sah bisa ditolak hanya karena
      // pemanggilnya lupa mengisi, dan yang tidak sah bisa lolos dengan
      // mengisinya sendiri.
      const hasil = await changeProjectStage({
        actor: pmA.actor,
        projectDbId,
        toStage: "tahap_satu",
        catalogue: CONTOH,
        note: "Kickoff selesai.",
      });

      expect(hasil.changed).toBe(true);
    },
    LAMBAT,
  );

  it(
    "PM yang tidak ditugaskan tetap ditolak walaupun jabatannya sama",
    async () => {
      const hasil = await changeProjectStage({
        actor: pmB.actor,
        projectDbId,
        toStage: "tahap_dua",
        catalogue: CONTOH,
      });

      expect(hasil.changed).toBe(false);

      const project = await testDb.project.findUniqueOrThrow({
        where: { id: projectDbId },
        select: { stage: true },
      });
      expect(project.stage).toBe("tahap_satu");
    },
    LAMBAT,
  );

  it(
    "Riwayat tahap menyimpan perpindahannya beserta pelakunya",
    async () => {
      const riwayat = await readStageHistory(projectDbId, CONTOH);

      expect(riwayat).toHaveLength(1);
      expect(riwayat[0].fromStage).toBeNull();
      expect(riwayat[0].toStage).toBe("tahap_satu");
      expect(riwayat[0].toLabel).toBe("Tahap Satu");
      expect(riwayat[0].note).toBe("Kickoff selesai.");
    },
    LAMBAT,
  );

  it(
    "Seluruh langkahnya meninggalkan jejak audit yang saling bersesuaian",
    async () => {
      const jejakProject = await testDb.auditLog.findMany({
        where: { objectType: AUDIT_OBJECTS.PROJECT, objectId: projectDbId },
        orderBy: { createdAt: "asc" },
        select: { action: true, actorId: true },
      });

      expect(jejakProject.map((row) => row.action)).toEqual([
        AUDIT_ACTIONS.PROJECT_CREATED,
        AUDIT_ACTIONS.PROJECT_PM_ASSIGNED,
        AUDIT_ACTIONS.PROJECT_STAGE_CHANGED,
      ]);

      // Pendaftaran dan penugasan dilakukan COO, perpindahan tahap oleh PM yang
      // ditugaskan. Pelakunya tercatat berbeda, bukan disamakan.
      expect(jejakProject[0].actorId).toBe(coo.userId);
      expect(jejakProject[1].actorId).toBe(coo.userId);
      expect(jejakProject[2].actorId).toBe(pmA.userId);

      const jejakClient = await testDb.auditLog.findMany({
        where: { objectType: AUDIT_OBJECTS.CLIENT, objectId: clientId },
        orderBy: { createdAt: "asc" },
        select: { action: true },
      });

      expect(jejakClient.map((row) => row.action)).toEqual([
        AUDIT_ACTIONS.CLIENT_CREATED,
        AUDIT_ACTIONS.CLIENT_UPDATED,
      ]);
    },
    LAMBAT,
  );

  it(
    "Jejak perpindahan tahap menyimpan nilai lama dan barunya",
    async () => {
      const jejak = await testDb.auditLog.findFirstOrThrow({
        where: {
          objectId: projectDbId,
          action: AUDIT_ACTIONS.PROJECT_STAGE_CHANGED,
        },
        select: { before: true, after: true, reason: true },
      });

      expect(jejak.before).toEqual({ stage: null });
      expect(jejak.after).toEqual({ stage: "tahap_satu" });
      expect(jejak.reason).toBe("Kickoff selesai.");
    },
    LAMBAT,
  );

  it(
    "Penolakan tidak meninggalkan jejak, karena tidak ada yang berubah",
    async () => {
      const jumlah = await testDb.auditLog.count({
        where: {
          objectId: projectDbId,
          action: AUDIT_ACTIONS.PROJECT_STAGE_CHANGED,
        },
      });

      expect(jumlah).toBe(1);
    },
    LAMBAT,
  );
});
