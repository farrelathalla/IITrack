import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registerProject } from "@/server/project/registration";
import {
  actorFrom,
  cleanUpProjects,
  resetCounter,
  testDb,
  uniqueEmail,
} from "../support/database";

const PREFIX = "f05-ac2-";
const PERIOD = "8802";

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

async function counterFor(period: string) {
  const row = await testDb.projectNumberCounter.findUnique({
    where: { period },
  });
  return row?.highestIssued ?? 0;
}

describe("F05-AC2 Penyimpanan ditolak kalau field wajib kosong dan nomor belum terbit sampai datanya lengkap.", () => {
  it("UAT-PRJ-002, pendaftaran tanpa nama project ditolak", async () => {
    const hasil = await registerProject({
      actor: pm.actor,
      input: { name: "   ", clientName: "PT Contoh", period: PERIOD },
    });

    expect(hasil.registered).toBe(false);
    if (hasil.registered) return;
    expect(hasil.fields?.name).toBeDefined();
  });

  it("Pendaftaran tanpa client ditolak", async () => {
    const hasil = await registerProject({
      actor: pm.actor,
      input: { name: "Project Tanpa Client", clientName: "", period: PERIOD },
    });

    expect(hasil.registered).toBe(false);
    if (hasil.registered) return;
    expect(hasil.fields?.clientName).toBeDefined();
  });

  it("Nomor belum terbit selama datanya belum lengkap, sehingga tidak ada nomor yang terbuang", async () => {
    const sebelum = await counterFor(PERIOD);

    await registerProject({
      actor: pm.actor,
      input: { name: "", clientName: "", period: PERIOD },
    });
    await registerProject({
      actor: pm.actor,
      input: { name: "Ada Nama", clientName: "", period: PERIOD },
    });

    expect(await counterFor(PERIOD)).toBe(sebelum);
    expect(await testDb.project.count({ where: { period: PERIOD } })).toBe(0);
  });

  it("Setelah datanya dilengkapi, pendaftaran berhasil dan mendapat nomor pertama", async () => {
    const hasil = await registerProject({
      actor: pm.actor,
      input: {
        name: "Project Lengkap",
        clientName: "PT Contoh",
        period: PERIOD,
      },
    });

    expect(hasil.registered).toBe(true);
    if (!hasil.registered) return;
    // 001, bukan 003, walaupun sudah ada dua percobaan yang ditolak sebelumnya.
    expect(hasil.projectId).toBe(`IIT-${PERIOD}-001`);
  });

  it("Penolakan menjelaskan alasannya dalam bahasa pengguna, bukan kode kesalahan", async () => {
    const hasil = await registerProject({
      actor: pm.actor,
      input: { name: "", clientName: "PT Contoh", period: PERIOD },
    });

    expect(hasil.registered).toBe(false);
    if (hasil.registered) return;
    expect(hasil.reason).toContain("belum");
    expect(hasil.reason).not.toMatch(/^[A-Z0-9_]+$/);
  });

  it("Jabatan yang tidak berwenang tidak bisa mendaftarkan project", async () => {
    const financePoc = await actorFrom(
      uniqueEmail(`${PREFIX}finance-`),
      "FINANCE_POC",
      "FINANCE",
    );

    const hasil = await registerProject({
      actor: financePoc.actor,
      input: {
        name: "Project Selundupan",
        clientName: "PT Contoh",
        period: PERIOD,
      },
    });

    expect(hasil.registered).toBe(false);
  });
});
