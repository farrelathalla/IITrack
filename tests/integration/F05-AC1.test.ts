import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerProject } from "@/server/project/registration";
import {
  actorFrom,
  cleanUpProjects,
  resetCounter,
  testDb,
  uniqueEmail,
} from "../support/database";

const PREFIX = "f05-ac1-";
const PERIOD = "9901";

let pm: Awaited<ReturnType<typeof actorFrom>>;

beforeAll(async () => {
  await cleanUpProjects(PERIOD);
  await resetCounter(PERIOD);
  pm = await actorFrom(uniqueEmail(PREFIX), "PROJECT_MANAGER", "OPERATIONAL");
});

afterAll(async () => {
  await cleanUpProjects(PERIOD);
  await resetCounter(PERIOD);
  await testDb.$disconnect();
});

async function daftar(name: string) {
  return registerProject({
    actor: pm.actor,
    input: { name, clientName: "PT Contoh", period: PERIOD },
  });
}

describe("F05-AC1 Project ID berformat IIT-2627-NNN, berurutan tanpa lompatan, dan tidak pernah didaur ulang termasuk untuk project yang dibatalkan.", () => {
  it("UAT-PRJ-001, project pertama pada sebuah periode mendapat nomor 001", async () => {
    const hasil = await daftar("Project Pertama");

    expect(hasil.registered).toBe(true);
    if (!hasil.registered) return;
    expect(hasil.projectId).toBe(`IIT-${PERIOD}-001`);
  });

  it("Nomor berikutnya berurutan tanpa lompatan", async () => {
    const kedua = await daftar("Project Kedua");
    const ketiga = await daftar("Project Ketiga");

    if (!kedua.registered || !ketiga.registered)
      throw new Error("Seharusnya berhasil");
    expect(kedua.projectId).toBe(`IIT-${PERIOD}-002`);
    expect(ketiga.projectId).toBe(`IIT-${PERIOD}-003`);
  });

  it("UAT-NFR-006, nomor project yang dibatalkan tidak pernah dipakai ulang", async () => {
    const dibatalkan = await daftar("Project Yang Dibatalkan");
    if (!dibatalkan.registered) throw new Error("Seharusnya berhasil");

    await testDb.project.update({
      where: { id: dibatalkan.id },
      data: { status: "CANCELLED" },
    });

    const berikutnya = await daftar("Project Setelah Pembatalan");
    if (!berikutnya.registered) throw new Error("Seharusnya berhasil");

    expect(berikutnya.projectId).not.toBe(dibatalkan.projectId);
    expect(berikutnya.projectId).toBe(`IIT-${PERIOD}-005`);
  });

  it("Basis data menolak dua project bernomor sama, bahkan bila ditulis langsung tanpa lewat aplikasi", async () => {
    const ada = await testDb.project.findFirst({ where: { period: PERIOD } });
    if (!ada) throw new Error("Butuh satu project sebagai pembanding");

    await expect(
      testDb.project.create({
        data: {
          projectId: ada.projectId,
          period: ada.period,
          sequence: 999,
          name: "Penyusup",
          clientName: "PT Contoh",
          registeredById: pm.userId,
        },
      }),
    ).rejects.toThrow();
  });

  it("Basis data menolak nomor yang bentuknya salah, walaupun ditulis langsung", async () => {
    await expect(
      testDb.project.create({
        data: {
          projectId: `IIT-${PERIOD}-000`,
          period: PERIOD,
          sequence: 0,
          name: "Nomor Nol",
          clientName: "PT Contoh",
          registeredById: pm.userId,
        },
      }),
    ).rejects.toThrow();
  });

  it("Basis data menolak teks nomor yang tidak cocok dengan periode dan urutannya", async () => {
    await expect(
      testDb.project.create({
        data: {
          projectId: `IIT-${PERIOD}-777`,
          period: PERIOD,
          sequence: 123,
          name: "Nomor Tidak Sinkron",
          clientName: "PT Contoh",
          registeredById: pm.userId,
        },
      }),
    ).rejects.toThrow();
  });

  it("Permintaan bersamaan tetap mendapat nomor berbeda dan berurutan", async () => {
    const sebelum = await testDb.project.count({ where: { period: PERIOD } });

    const hasil = await Promise.all([
      daftar("Bersamaan A"),
      daftar("Bersamaan B"),
      daftar("Bersamaan C"),
    ]);

    const nomor = hasil.map((h) => (h.registered ? h.projectId : null));
    expect(new Set(nomor).size).toBe(3);
    expect(nomor).not.toContain(null);

    const sesudah = await testDb.project.count({ where: { period: PERIOD } });
    expect(sesudah).toBe(sebelum + 3);
  });
});
