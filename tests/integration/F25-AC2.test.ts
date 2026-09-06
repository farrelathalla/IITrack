import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { assignProjectManager } from "@/server/project/assignment";
import { assignMember } from "@/server/project/members";
import {
  addReference,
  readProjectReferences,
  readProjectRepository,
} from "@/server/project/references";
import { registerProject } from "@/server/project/registration";
import {
  actorFrom,
  testDb,
  uniqueEmail,
  uniquePeriod,
} from "../support/database";

const PREFIX = "f25-";
const PERIOD = uniquePeriod();

let coo: Awaited<ReturnType<typeof actorFrom>>;
let cto: Awaited<ReturnType<typeof actorFrom>>;
let pm: Awaited<ReturnType<typeof actorFrom>>;
let dev: Awaited<ReturnType<typeof actorFrom>>;
let financePoc: Awaited<ReturnType<typeof actorFrom>>;
let projectA: string;
let projectB: string;

async function projectBaru(nama: string) {
  const hasil = await registerProject({
    actor: coo.actor,
    input: { name: nama, clientName: "PT Contoh", period: PERIOD },
  });
  if (!hasil.registered) throw new Error(`Pendaftaran gagal: ${hasil.reason}`);
  return hasil.id;
}

beforeAll(async () => {
  coo = await actorFrom(uniqueEmail(`${PREFIX}coo-`), "COO", "OPERATIONAL");
  cto = await actorFrom(uniqueEmail(`${PREFIX}cto-`), "CTO", "TECHDEV");
  pm = await actorFrom(
    uniqueEmail(`${PREFIX}pm-`),
    "PROJECT_MANAGER",
    "OPERATIONAL",
  );
  dev = await actorFrom(
    uniqueEmail(`${PREFIX}dev-`),
    "TECHDEV_MEMBER",
    "TECHDEV",
  );
  financePoc = await actorFrom(
    uniqueEmail(`${PREFIX}fin-`),
    "FINANCE_POC",
    "FINANCE",
  );

  projectA = await projectBaru("Project Rujukan A");
  projectB = await projectBaru("Project Rujukan B");

  await assignProjectManager({
    actor: coo.actor,
    projectDbId: projectA,
    pmUserId: pm.userId,
  });
  await assignMember({
    actor: cto.actor,
    projectDbId: projectA,
    userId: dev.userId,
    division: "TECHDEV",
  });
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe("F25-AC1 Tautan tersimpan bersama Project ID dan membuka resource project yang benar, tidak tertukar dengan project lain.", () => {
  it("UAT-DATA-001, PM menautkan berkas Google Drive ke projectnya", async () => {
    const hasil = await addReference({
      actor: pm.actor,
      projectDbId: projectA,
      url: "https://drive.google.com/drive/folders/berkas-project-a",
      label: "Folder Project A",
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.kind).toBe("GOOGLE_DRIVE");
  });

  it("Tautan project lain tidak pernah ikut terbawa", async () => {
    await addReference({
      actor: pm.actor,
      projectDbId: projectA,
      url: "https://iit.notion.site/Catatan-Project-A",
      label: "Catatan Project A",
    });

    const rujukanA = await readProjectReferences(projectA);
    const rujukanB = await readProjectReferences(projectB);

    expect(rujukanA.length).toBeGreaterThanOrEqual(2);
    expect(rujukanB).toHaveLength(0);
    expect(rujukanA.every((r) => r.label.includes("Project A"))).toBe(true);
  });

  it("Alamat yang bentuknya salah ditolak beserta penjelasannya", async () => {
    for (const salah of ["bukan url", "http://drive.google.com/a", ""]) {
      const hasil = await addReference({
        actor: pm.actor,
        projectDbId: projectA,
        url: salah,
        label: "Tautan Salah",
      });

      expect(hasil.ok).toBe(false);
      if (hasil.ok) continue;
      expect(hasil.reason).toContain("https://");
    }
  });

  it("Tautan yang sama tidak tersimpan dua kali walau ditulis berbeda", async () => {
    const hasil = await addReference({
      actor: pm.actor,
      projectDbId: projectA,
      url: "https://DRIVE.google.com/drive/folders/berkas-project-a/",
      label: "Folder Project A lagi",
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.reason).toContain("sudah tersimpan");
  });

  it("Tautan tercatat di jejak aktivitas", async () => {
    const jejak = await testDb.auditLog.count({
      where: { action: AUDIT_ACTIONS.REFERENCE_ADDED, objectId: projectA },
    });

    expect(jejak).toBeGreaterThanOrEqual(2);
  });
});

describe("F25-AC2 Repository yang tertaut bisa dibuka dari Project Hub.", () => {
  it("UAT-SDM-004, CTO menautkan repository GitHub project", async () => {
    const hasil = await addReference({
      actor: cto.actor,
      projectDbId: projectA,
      url: "https://github.com/InkubatorIT/IITrack",
      label: "Repository IITrack",
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.kind).toBe("GITHUB_REPO");
  });

  it("Repository dapat dibaca langsung dari Project Hub", async () => {
    const repo = await readProjectRepository(projectA);

    expect(repo).not.toBeNull();
    expect(repo?.url).toBe("https://github.com/InkubatorIT/IITrack");
    expect(repo?.label).toBe("Repository IITrack");
  });

  it("Project tanpa repository mengembalikan kosong, bukan repository project lain", async () => {
    expect(await readProjectRepository(projectB)).toBeNull();
  });

  it("Alamat GitHub yang bukan repository ditolak", async () => {
    const hasil = await addReference({
      actor: cto.actor,
      projectDbId: projectB,
      url: "https://github.com/InkubatorIT",
      label: "Organisasi",
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.reason).toContain("bukan alamat sebuah repository");
  });

  it("Pelaksana TechDev yang ditugaskan juga bisa menautkan repository", async () => {
    const hasil = await addReference({
      actor: dev.actor,
      projectDbId: projectA,
      url: "https://github.com/InkubatorIT/IITrack-docs",
      label: "Repository dokumentasi",
    });

    expect(hasil.ok).toBe(true);
  });

  it("Pelaksana Finance tidak bisa menautkan repository, karena bukan domainnya", async () => {
    const hasil = await addReference({
      actor: financePoc.actor,
      projectDbId: projectA,
      url: "https://github.com/InkubatorIT/IITrack-finance",
      label: "Repository finance",
    });

    expect(hasil.ok).toBe(false);
  });

  it("Yang bukan pelaksana project tidak bisa menautkan apa pun", async () => {
    const pmLain = await actorFrom(
      uniqueEmail(`${PREFIX}pmlain-`),
      "PROJECT_MANAGER",
      "OPERATIONAL",
    );

    const hasil = await addReference({
      actor: pmLain.actor,
      projectDbId: projectA,
      url: "https://drive.google.com/drive/folders/selundupan",
      label: "Selundupan",
    });

    expect(hasil.ok).toBe(false);
  });
});
