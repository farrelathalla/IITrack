import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { parseProjectId } from "@/lib/project/project-id";
import {
  overrideProjectId,
  registerProject,
} from "@/server/project/registration";
import {
  actorFrom,
  cleanUpProjects,
  resetCounter,
  testDb,
  uniqueEmail,
} from "../support/database";

const PREFIX = "f05-ac3-";
const PERIOD = "8803";

let pm: Awaited<ReturnType<typeof actorFrom>>;
let coo: Awaited<ReturnType<typeof actorFrom>>;

beforeAll(async () => {
  await cleanUpProjects(PERIOD);
  await resetCounter(PERIOD);
  pm = await actorFrom(
    uniqueEmail(`${PREFIX}pm-`),
    "PROJECT_MANAGER",
    "OPERATIONAL",
  );
  coo = await actorFrom(uniqueEmail(`${PREFIX}coo-`), "COO", "OPERATIONAL");
});

afterAll(async () => {
  await cleanUpProjects(PERIOD);
  await resetCounter(PERIOD);
  await testDb.$disconnect();
});

async function daftarBaru(name: string) {
  const hasil = await registerProject({
    actor: pm.actor,
    input: { name, clientName: "PT Contoh", period: PERIOD },
  });
  if (!hasil.registered) throw new Error(`Pendaftaran gagal: ${hasil.reason}`);
  return hasil;
}

describe("F05-AC3 COO atau Vice COO bisa menetapkan nomor manual, dan penetapan itu tercatat beserta nilai lama dan barunya.", () => {
  it("UAT-PRJ-005, COO dapat menetapkan nomor manual", async () => {
    const project = await daftarBaru("Project Untuk Ditimpa");

    const hasil = await overrideProjectId({
      actor: coo.actor,
      projectDbId: project.id,
      newProjectId: `IIT-${PERIOD}-750`,
      reason: "Nomor sudah terlanjur dipakai di MoU yang dikirim ke client.",
    });

    expect(hasil.overridden).toBe(true);

    const tersimpan = await testDb.project.findUnique({
      where: { id: project.id },
    });
    expect(tersimpan?.projectId).toBe(`IIT-${PERIOD}-750`);
    expect(tersimpan?.sequence).toBe(750);
  });

  it("Penetapan tercatat beserta nilai lama dan nilai barunya", async () => {
    const project = await daftarBaru("Project Untuk Jejak");
    const nomorLama = project.projectId;

    await overrideProjectId({
      actor: coo.actor,
      projectDbId: project.id,
      newProjectId: `IIT-${PERIOD}-800`,
      reason: "Permintaan tertulis dari client.",
    });

    const jejak = await testDb.auditLog.findFirst({
      where: {
        action: AUDIT_ACTIONS.PROJECT_ID_OVERRIDDEN,
        objectType: AUDIT_OBJECTS.PROJECT,
        objectId: project.id,
      },
    });

    expect(jejak).not.toBeNull();
    expect(jejak?.actorId).toBe(coo.userId);
    expect(jejak?.before).toEqual({ projectId: nomorLama });
    expect(jejak?.after).toEqual({ projectId: `IIT-${PERIOD}-800` });
    expect(jejak?.reason).toBe("Permintaan tertulis dari client.");
  });

  it("Penetapan tanpa alasan ditolak", async () => {
    const project = await daftarBaru("Project Tanpa Alasan");

    const hasil = await overrideProjectId({
      actor: coo.actor,
      projectDbId: project.id,
      newProjectId: `IIT-${PERIOD}-810`,
      reason: "   ",
    });

    expect(hasil.overridden).toBe(false);
  });

  it("Nomor yang bentuknya salah ditolak", async () => {
    const project = await daftarBaru("Project Format Salah");

    const hasil = await overrideProjectId({
      actor: coo.actor,
      projectDbId: project.id,
      newProjectId: `IIT-${PERIOD}-7`,
      reason: "Uji format.",
    });

    expect(hasil.overridden).toBe(false);
  });

  it("Nomor yang sudah dipakai project lain ditolak, dan alasannya dijelaskan", async () => {
    const pertama = await daftarBaru("Project Pemilik Nomor");
    const kedua = await daftarBaru("Project Peminta Nomor");

    const hasil = await overrideProjectId({
      actor: coo.actor,
      projectDbId: kedua.id,
      newProjectId: pertama.projectId,
      reason: "Sengaja menabrak nomor yang sudah ada.",
    });

    expect(hasil.overridden).toBe(false);
    if (hasil.overridden) return;
    expect(hasil.reason).toContain("sudah dipakai");
  });

  it("Penerbitan berikutnya melanjutkan dari nomor manual tertinggi, sehingga tidak bertabrakan", async () => {
    const sebelum = await testDb.projectNumberCounter.findUnique({
      where: { period: PERIOD },
    });
    const tertinggiSebelumnya = sebelum?.highestIssued ?? 0;

    const berikutnya = await daftarBaru("Project Setelah Penetapan Manual");
    const terurai = parseProjectId(berikutnya.projectId);

    expect(terurai).not.toBeNull();
    // Bertambah tepat satu, dan sudah melewati 800 yang ditetapkan manual tadi,
    // sehingga penerbitan otomatis tidak mungkin menabrak nomor manual.
    expect(terurai?.sequence).toBe(tertinggiSebelumnya + 1);
    expect(terurai?.sequence).toBeGreaterThan(800);
  });

  it("UAT-PRJ-006, PM tidak bisa menetapkan nomor manual walaupun project itu miliknya", async () => {
    const project = await daftarBaru("Project Milik PM");
    const nomorAsli = project.projectId;

    const hasil = await overrideProjectId({
      actor: pm.actor,
      projectDbId: project.id,
      newProjectId: `IIT-${PERIOD}-900`,
      reason: "PM mencoba menetapkan sendiri.",
    });

    expect(hasil.overridden).toBe(false);

    const tersimpan = await testDb.project.findUnique({
      where: { id: project.id },
    });
    expect(tersimpan?.projectId).toBe(nomorAsli);
  });
});
