import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { assignProjectManager } from "@/server/project/assignment";
import { projectContextFor } from "@/server/project/context";
import { registerProject } from "@/server/project/registration";
import {
  fulfillStaffingRequest,
  readStaffingQueue,
  requestStaffing,
} from "@/server/techdev/staffing";
import {
  actorFrom,
  testDb,
  uniqueEmail,
  uniquePeriod,
} from "../support/database";

const PREFIX = "f14-";
const PERIOD = uniquePeriod();

/** Selasa 1 September 2026 pukul 09.00 WIB. */
const DIAJUKAN = new Date("2026-09-01T09:00:00+07:00");
/** Selasa yang sama pukul 13.00 WIB, empat jam kerja sesudahnya. */
const DITETAPKAN = new Date("2026-09-01T13:00:00+07:00");

let coo: Awaited<ReturnType<typeof actorFrom>>;
let cto: Awaited<ReturnType<typeof actorFrom>>;
let pm: Awaited<ReturnType<typeof actorFrom>>;
let dev1: Awaited<ReturnType<typeof actorFrom>>;
let dev2: Awaited<ReturnType<typeof actorFrom>>;
let projectId: string;
let requestId: string;

const ISI = {
  roleNeeded: "Backend Developer",
  headcount: 2,
  neededBy: new Date("2026-09-15T00:00:00.000Z"),
  technicalNeeds: "Next.js, Prisma, PostgreSQL",
  deliverable: "API termin dan invoice siap diuji",
};

beforeAll(async () => {
  coo = await actorFrom(uniqueEmail(`${PREFIX}coo-`), "COO", "OPERATIONAL");
  cto = await actorFrom(uniqueEmail(`${PREFIX}cto-`), "CTO", "TECHDEV");
  pm = await actorFrom(
    uniqueEmail(`${PREFIX}pm-`),
    "PROJECT_MANAGER",
    "OPERATIONAL",
  );
  dev1 = await actorFrom(
    uniqueEmail(`${PREFIX}dev1-`),
    "TECHDEV_MEMBER",
    "TECHDEV",
  );
  dev2 = await actorFrom(
    uniqueEmail(`${PREFIX}dev2-`),
    "TECHDEV_MEMBER",
    "TECHDEV",
  );

  const hasil = await registerProject({
    actor: coo.actor,
    input: {
      name: "Project Staffing",
      clientName: "PT Contoh",
      period: PERIOD,
    },
  });
  if (!hasil.registered) throw new Error(`Pendaftaran gagal: ${hasil.reason}`);
  projectId = hasil.id;

  await assignProjectManager({
    actor: coo.actor,
    projectDbId: projectId,
    pmUserId: pm.userId,
  });
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe("F14-AC1 Pengajuan memuat Project ID, jabatan yang dibutuhkan, jumlah, tanggal dibutuhkan, kebutuhan teknis, dan deliverable.", () => {
  it("UAT-SDM-001, PM mengajukan kebutuhan programmer beserta seluruh isinya", async () => {
    const hasil = await requestStaffing({
      actor: pm.actor,
      projectDbId: projectId,
      ...ISI,
      now: DIAJUKAN,
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    requestId = hasil.requestId;

    const tersimpan = await testDb.staffingRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { project: { select: { projectId: true } } },
    });

    expect(tersimpan.project.projectId).toMatch(/^IIT-/);
    expect(tersimpan.roleNeeded).toBe("Backend Developer");
    expect(tersimpan.headcount).toBe(2);
    expect(tersimpan.neededBy).toBeInstanceOf(Date);
    expect(tersimpan.technicalNeeds).toContain("Prisma");
    expect(tersimpan.deliverable).toContain("termin");
    expect(tersimpan.requestedAt.toISOString()).toBe(DIAJUKAN.toISOString());
  });

  it("Isian yang belum lengkap ditolak beserta galat per kolomnya", async () => {
    const hasil = await requestStaffing({
      actor: pm.actor,
      projectDbId: projectId,
      ...ISI,
      technicalNeeds: "   ",
      headcount: 0,
      now: DIAJUKAN,
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.fields?.technicalNeeds).toBeDefined();
    expect(hasil.fields?.headcount).toBeDefined();
  });

  it("Yang bukan pelaksana project tidak bisa mengajukan", async () => {
    const pmLain = await actorFrom(
      uniqueEmail(`${PREFIX}pmlain-`),
      "PROJECT_MANAGER",
      "OPERATIONAL",
    );

    const hasil = await requestStaffing({
      actor: pmLain.actor,
      projectDbId: projectId,
      ...ISI,
      now: DIAJUKAN,
    });

    expect(hasil.ok).toBe(false);
  });
});

describe("F14-AC2 Request masuk antrean TechDev dengan konteks project yang bisa dibaca CTO.", () => {
  it("UAT-SDM-002, permintaan muncul di antrean beserta konteks projectnya", async () => {
    const antrean = await readStaffingQueue(DITETAPKAN);
    const milikKita = antrean.find((row) => row.id === requestId);

    expect(milikKita).toBeDefined();
    expect(milikKita?.projectId).toMatch(/^IIT-/);
    expect(milikKita?.projectName).toBe("Project Staffing");
    expect(milikKita?.clientName).toBe("PT Contoh");
    expect(milikKita?.roleNeeded).toBe("Backend Developer");
  });

  it("Lama menunggu dihitung dalam jam kerja, bukan jam kalender", async () => {
    const antrean = await readStaffingQueue(DITETAPKAN);
    const milikKita = antrean.find((row) => row.id === requestId);

    // 09.00 sampai 13.00 pada hari kerja yang sama.
    expect(milikKita?.waitingWorkingMinutes).toBe(240);
  });

  it("Akhir pekan tidak dihitung sebagai lama menunggu", async () => {
    // Sabtu 5 September pukul 10.00 WIB.
    const sabtu = new Date("2026-09-05T10:00:00+07:00");
    const antrean = await readStaffingQueue(sabtu);
    const milikKita = antrean.find((row) => row.id === requestId);

    // Selasa 09.00 sampai Sabtu: Selasa 8 jam, Rabu 8, Kamis 8, Jumat 8 = 1920.
    expect(milikKita?.waitingWorkingMinutes).toBe(1920);
  });
});

describe("F14-AC3 Setelah CTO menetapkan anggota, PM melihat status Ditetapkan, dan pelaku serta waktunya tercatat.", () => {
  it("Jabatan selain CTO tidak bisa menetapkan anggota", async () => {
    const hasil = await fulfillStaffingRequest({
      actor: pm.actor,
      requestId,
      memberUserIds: [dev1.userId],
      now: DITETAPKAN,
    });

    expect(hasil.ok).toBe(false);
  });

  it("Penetapan tanpa anggota ditolak", async () => {
    const hasil = await fulfillStaffingRequest({
      actor: cto.actor,
      requestId,
      memberUserIds: [],
      now: DITETAPKAN,
    });

    expect(hasil.ok).toBe(false);
  });

  it("UAT-SDM-003, CTO menetapkan anggota dan lama tanggapannya terukur", async () => {
    const hasil = await fulfillStaffingRequest({
      actor: cto.actor,
      requestId,
      memberUserIds: [dev1.userId, dev2.userId],
      now: DITETAPKAN,
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.responseTime.workingMinutes).toBe(240);

    const tersimpan = await testDb.staffingRequest.findUniqueOrThrow({
      where: { id: requestId },
    });
    expect(tersimpan.status).toBe("FULFILLED");
    expect(tersimpan.fulfilledById).toBe(cto.userId);
    expect(tersimpan.fulfilledAt?.toISOString()).toBe(DITETAPKAN.toISOString());
  });

  it("Anggota yang ditetapkan langsung menjadi pelaksana TechDev project itu", async () => {
    for (const dev of [dev1, dev2]) {
      const konteks = await projectContextFor(dev.actor, projectId);
      expect(konteks.assignedDivisions).toContain("TECHDEV");
    }
  });

  it("Pengajuan pada rantai persetujuan ikut selesai", async () => {
    const tersimpan = await testDb.staffingRequest.findUniqueOrThrow({
      where: { id: requestId },
      include: { submission: true },
    });

    expect(tersimpan.submission?.status).toBe("APPROVED");
  });

  it("Permintaan yang sudah ditetapkan hilang dari antrean", async () => {
    const antrean = await readStaffingQueue(DITETAPKAN);

    expect(antrean.find((row) => row.id === requestId)).toBeUndefined();
  });

  it("Penetapan tidak bisa diulang", async () => {
    const hasil = await fulfillStaffingRequest({
      actor: cto.actor,
      requestId,
      memberUserIds: [dev1.userId],
      now: DITETAPKAN,
    });

    expect(hasil.ok).toBe(false);
  });

  it("Pengajuan dan penetapan tercatat di jejak aktivitas", async () => {
    const diajukan = await testDb.auditLog.findFirst({
      where: {
        action: AUDIT_ACTIONS.STAFFING_REQUESTED,
        objectType: AUDIT_OBJECTS.STAFFING_REQUEST,
        objectId: requestId,
      },
    });
    const ditetapkan = await testDb.auditLog.findFirst({
      where: {
        action: AUDIT_ACTIONS.STAFFING_FULFILLED,
        objectId: requestId,
      },
    });

    expect(diajukan?.actorId).toBe(pm.userId);
    expect(ditetapkan?.actorId).toBe(cto.userId);
    expect(ditetapkan?.after).toMatchObject({ lamaTanggapanMenitKerja: 240 });
  });
});

describe("F14-AC4 Repository project ditautkan pada langkah yang sama.", () => {
  it("Repository yang disebut CTO saat menetapkan anggota langsung tertaut ke project", async () => {
    const permintaan = await requestStaffing({
      actor: pm.actor,
      projectDbId: projectId,
      ...ISI,
      now: DIAJUKAN,
    });
    if (!permintaan.ok) throw new Error(permintaan.reason);

    const hasil = await fulfillStaffingRequest({
      actor: cto.actor,
      requestId: permintaan.requestId,
      memberUserIds: [dev1.userId],
      repositoryUrl: "https://github.com/inkubator-it/proyek-staffing",
      now: DITETAPKAN,
    });

    expect(hasil.ok).toBe(true);

    const rujukan = await testDb.externalReference.findFirst({
      where: { projectId, kind: "GITHUB_REPO" },
      select: { url: true, projectId: true },
    });

    expect(rujukan?.projectId).toBe(projectId);
    expect(rujukan?.url).toContain("github.com/inkubator-it/proyek-staffing");
  });

  it("Penetapan tanpa menyebut repository tetap berhasil", async () => {
    const permintaan = await requestStaffing({
      actor: pm.actor,
      projectDbId: projectId,
      ...ISI,
      now: DIAJUKAN,
    });
    if (!permintaan.ok) throw new Error(permintaan.reason);

    const hasil = await fulfillStaffingRequest({
      actor: cto.actor,
      requestId: permintaan.requestId,
      memberUserIds: [dev2.userId],
      now: DITETAPKAN,
    });

    expect(hasil.ok).toBe(true);
  });
});
