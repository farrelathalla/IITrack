import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { checkPermission } from "@/lib/auth/permissions";
import { projectContextFor } from "@/server/project/context";
import { assignMember, endAssignment } from "@/server/project/members";
import { registerProject } from "@/server/project/registration";
import {
  actorFrom,
  testDb,
  uniqueEmail,
  uniquePeriod,
} from "../support/database";

const PREFIX = "f31-";
const PERIOD = uniquePeriod();

let coo: Awaited<ReturnType<typeof actorFrom>>;
let cfo: Awaited<ReturnType<typeof actorFrom>>;
let cto: Awaited<ReturnType<typeof actorFrom>>;
let officer: Awaited<ReturnType<typeof actorFrom>>;
let officerLain: Awaited<ReturnType<typeof actorFrom>>;
let financePoc: Awaited<ReturnType<typeof actorFrom>>;
let techdev: Awaited<ReturnType<typeof actorFrom>>;
let projectId: string;

beforeAll(async () => {
  coo = await actorFrom(uniqueEmail(`${PREFIX}coo-`), "COO", "OPERATIONAL");
  cfo = await actorFrom(uniqueEmail(`${PREFIX}cfo-`), "CFO", "FINANCE");
  cto = await actorFrom(uniqueEmail(`${PREFIX}cto-`), "CTO", "TECHDEV");
  officer = await actorFrom(
    uniqueEmail(`${PREFIX}ops-`),
    "OFFICER_OPERATIONAL",
    "OPERATIONAL",
  );
  officerLain = await actorFrom(
    uniqueEmail(`${PREFIX}ops2-`),
    "OFFICER_OPERATIONAL",
    "OPERATIONAL",
  );
  financePoc = await actorFrom(
    uniqueEmail(`${PREFIX}fin-`),
    "FINANCE_POC",
    "FINANCE",
  );
  techdev = await actorFrom(
    uniqueEmail(`${PREFIX}dev-`),
    "TECHDEV_MEMBER",
    "TECHDEV",
  );

  const hasil = await registerProject({
    actor: coo.actor,
    input: {
      name: "Project Penugasan",
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

describe("F31-AC1 C-Level hanya bisa menugaskan staf dari domainnya sendiri, dan pilihan lintas domain ditolak.", () => {
  it("UAT-ASSIGN-001, COO dapat menugaskan pelaksana Operational", async () => {
    const hasil = await assignMember({
      actor: coo.actor,
      projectDbId: projectId,
      userId: officer.userId,
      division: "OPERATIONAL",
    });

    expect(hasil.ok).toBe(true);
  });

  it("COO ditolak ketika mencoba menugaskan pelaksana Finance", async () => {
    const hasil = await assignMember({
      actor: coo.actor,
      projectDbId: projectId,
      userId: financePoc.userId,
      division: "FINANCE",
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.reason).toContain("divisi yang Anda pimpin");
  });

  it("Orang yang jabatannya di divisi lain tidak bisa ditugaskan ke divisi itu", async () => {
    const hasil = await assignMember({
      actor: cfo.actor,
      projectDbId: projectId,
      userId: officer.userId,
      division: "FINANCE",
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.reason).toContain("tidak sedang menjabat");
  });

  it("Penugasan ganda pada divisi yang sama ditolak", async () => {
    const hasil = await assignMember({
      actor: coo.actor,
      projectDbId: projectId,
      userId: officer.userId,
      division: "OPERATIONAL",
    });

    expect(hasil.ok).toBe(false);
  });
});

describe("F31-AC4 Satu project bisa punya pelaksana dari tiga divisi sekaligus.", () => {
  it("CFO menugaskan pelaksana Finance dan CTO menugaskan pelaksana TechDev pada project yang sama", async () => {
    const finance = await assignMember({
      actor: cfo.actor,
      projectDbId: projectId,
      userId: financePoc.userId,
      division: "FINANCE",
    });
    const dev = await assignMember({
      actor: cto.actor,
      projectDbId: projectId,
      userId: techdev.userId,
      division: "TECHDEV",
    });

    expect(finance.ok).toBe(true);
    expect(dev.ok).toBe(true);

    const aktif = await testDb.projectAssignment.findMany({
      where: { projectId, endedAt: null },
    });
    expect(new Set(aktif.map((a) => a.division))).toEqual(
      new Set(["OPERATIONAL", "FINANCE", "TECHDEV"]),
    );
  });
});

describe("F31-AC2 Penugasan langsung memberi hak edit tanpa pengaturan manual.", () => {
  it("Pelaksana Operational langsung memperoleh hak edit Operational", async () => {
    const konteks = await projectContextFor(officer.actor, projectId);

    expect(konteks.assignedDivisions).toContain("OPERATIONAL");
    expect(
      checkPermission({
        actor: officer.actor,
        action: "project.edit_operational",
        project: konteks,
        now: new Date(),
      }).allowed,
    ).toBe(true);
  });

  it("Pelaksana Finance memperoleh hak edit Finance, tetapi tidak hak edit Operational", async () => {
    const konteks = await projectContextFor(financePoc.actor, projectId);

    expect(konteks.assignedDivisions).toEqual(["FINANCE"]);
    expect(
      checkPermission({
        actor: financePoc.actor,
        action: "finance.edit",
        project: konteks,
        now: new Date(),
      }).allowed,
    ).toBe(true);
    expect(
      checkPermission({
        actor: financePoc.actor,
        action: "project.edit_operational",
        project: konteks,
        now: new Date(),
      }).allowed,
    ).toBe(false);
  });

  it("UAT-ASSIGN-005, yang bukan pelaksana tetap bisa melihat informasi inti project", async () => {
    const konteks = await projectContextFor(officerLain.actor, projectId);

    expect(konteks.assignedDivisions).toHaveLength(0);
    expect(
      checkPermission({
        actor: officerLain.actor,
        action: "project.view",
        project: konteks,
        now: new Date(),
      }).allowed,
    ).toBe(true);
    expect(
      checkPermission({
        actor: officerLain.actor,
        action: "project.edit_operational",
        project: konteks,
        now: new Date(),
      }).allowed,
    ).toBe(false);
  });
});

describe("F31-AC3 Pemindahan penugasan memindahkan hak edit tanpa mengubah jabatan global, dan riwayat penugasan lama tidak dihapus.", () => {
  it("UAT-ASSIGN-003, penugasan yang diakhiri mencabut hak editnya", async () => {
    const penugasan = await testDb.projectAssignment.findFirstOrThrow({
      where: { projectId, userId: officer.userId, endedAt: null },
    });

    const hasil = await endAssignment({
      actor: coo.actor,
      assignmentId: penugasan.id,
    });
    expect(hasil.ok).toBe(true);

    const konteks = await projectContextFor(officer.actor, projectId);
    expect(konteks.assignedDivisions).toHaveLength(0);
  });

  it("Riwayat penugasan lama tidak dihapus, hanya ditandai berakhir", async () => {
    const semua = await testDb.projectAssignment.findMany({
      where: { projectId, userId: officer.userId },
    });

    expect(semua.length).toBeGreaterThan(0);
    expect(semua.some((a) => a.endedAt !== null)).toBe(true);
  });

  it("Jabatan global pelaksana lama tidak berubah setelah penugasannya dicabut", async () => {
    const jabatan = await testDb.roleAssignment.findFirstOrThrow({
      where: { userId: officer.userId },
    });

    expect(jabatan.role).toBe("OFFICER_OPERATIONAL");
    expect(jabatan.endDate).toBeNull();
  });

  it("Penugasan dapat dipindahkan ke orang lain, dan hak editnya ikut berpindah", async () => {
    const hasil = await assignMember({
      actor: coo.actor,
      projectDbId: projectId,
      userId: officerLain.userId,
      division: "OPERATIONAL",
    });
    expect(hasil.ok).toBe(true);

    expect(
      (await projectContextFor(officerLain.actor, projectId)).assignedDivisions,
    ).toContain("OPERATIONAL");
    expect(
      (await projectContextFor(officer.actor, projectId)).assignedDivisions,
    ).toHaveLength(0);
  });

  it("Penugasan dan pencabutannya tercatat di jejak aktivitas", async () => {
    const ditugaskan = await testDb.auditLog.count({
      where: {
        action: AUDIT_ACTIONS.PROJECT_MEMBER_ASSIGNED,
        objectId: projectId,
      },
    });
    const dicabut = await testDb.auditLog.count({
      where: {
        action: AUDIT_ACTIONS.PROJECT_MEMBER_UNASSIGNED,
        objectId: projectId,
      },
    });

    expect(ditugaskan).toBeGreaterThanOrEqual(4);
    expect(dicabut).toBeGreaterThanOrEqual(1);
  });
});
