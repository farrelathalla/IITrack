import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { checkPermission } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/types";
import {
  assignRole,
  deactivateUser,
  handoverRole,
  overrideRolePeriod,
} from "@/server/member/management";
import { actorFrom, testDb, uniqueEmail } from "../support/database";

const PREFIX = "f07-";

const PERIODE_LAMA_MULAI = new Date("2026-08-01T00:00:00.000Z");
const SERAH_TERIMA = new Date("2027-08-01T00:00:00.000Z");

/** Authorized TechDev, yaitu anggota TechDev pemegang System Administrator privilege. */
let admin: Awaited<ReturnType<typeof actorFrom>>;
let coo: Awaited<ReturnType<typeof actorFrom>>;
let pengurusLama: Awaited<ReturnType<typeof actorFrom>>;
let pengurusBaru: Awaited<ReturnType<typeof actorFrom>>;

/** Membaca ulang actor dari basis data supaya jabatannya mencerminkan perubahan. */
async function reloadActor(userId: string): Promise<Actor> {
  const user = await testDb.user.findUniqueOrThrow({
    where: { id: userId },
    include: { roleAssignments: true },
  });

  return {
    userId: user.id,
    status: user.status as Actor["status"],
    roleAssignments: user.roleAssignments.map((a) => ({
      role: a.role as Actor["roleAssignments"][number]["role"],
      division: a.division as Actor["roleAssignments"][number]["division"],
      startDate: a.startDate,
      endDate: a.endDate,
      isSystemAdmin: a.isSystemAdmin,
    })),
  };
}

beforeAll(async () => {
  admin = await actorFrom(
    uniqueEmail(`${PREFIX}admin-`),
    "TECHDEV_MEMBER",
    "TECHDEV",
  );
  await testDb.roleAssignment.updateMany({
    where: { userId: admin.userId },
    data: { isSystemAdmin: true },
  });
  admin.actor = await reloadActor(admin.userId);

  coo = await actorFrom(uniqueEmail(`${PREFIX}coo-`), "COO", "OPERATIONAL");
  pengurusLama = await actorFrom(
    uniqueEmail(`${PREFIX}lama-`),
    "FINANCE_POC",
    "FINANCE",
  );
  pengurusBaru = await actorFrom(
    uniqueEmail(`${PREFIX}baru-`),
    "OFFICER_OPERATIONAL",
    "OPERATIONAL",
  );
});

afterAll(async () => {
  await testDb.$disconnect();
});

describe("F07-AC2 Authorized TechDev bisa meng-override periode untuk kondisi khusus dengan mengisi alasan, dan override itu tercatat beserta pelaku dan waktunya.", () => {
  it("UAT-USER-001, Authorized TechDev dapat menetapkan jabatan beserta periodenya", async () => {
    const hasil = await assignRole({
      actor: admin.actor,
      userId: pengurusBaru.userId,
      role: "PROJECT_MANAGER",
      division: "OPERATIONAL",
      period: "2026/2027",
      startDate: PERIODE_LAMA_MULAI,
      endDate: SERAH_TERIMA,
    });

    expect(hasil.ok).toBe(true);
  });

  it("Penetapan yang beririsan dengan masa jabatan yang sama ditolak", async () => {
    const hasil = await assignRole({
      actor: admin.actor,
      userId: pengurusBaru.userId,
      role: "PROJECT_MANAGER",
      division: "OPERATIONAL",
      period: "2027/2028",
      startDate: new Date("2027-01-01T00:00:00.000Z"),
      endDate: new Date("2028-01-01T00:00:00.000Z"),
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;
    expect(hasil.reason).toContain("beririsan");
  });

  it("Jabatan yang bukan pemegang System Administrator privilege tidak bisa mengelola jabatan", async () => {
    const hasil = await assignRole({
      actor: coo.actor,
      userId: pengurusBaru.userId,
      role: "FINANCE_POC",
      division: "FINANCE",
      period: "2026/2027",
      startDate: PERIODE_LAMA_MULAI,
      endDate: SERAH_TERIMA,
    });

    expect(hasil.ok).toBe(false);
  });

  it("UAT-USER-002, perubahan masa jabatan tanpa alasan ditolak", async () => {
    const penetapan = await testDb.roleAssignment.findFirstOrThrow({
      where: { userId: pengurusLama.userId },
    });

    const hasil = await overrideRolePeriod({
      actor: admin.actor,
      roleAssignmentId: penetapan.id,
      newEndDate: SERAH_TERIMA,
      reason: "   ",
    });

    expect(hasil.ok).toBe(false);
  });

  it("Perubahan masa jabatan tercatat beserta nilai lama, nilai baru, pelaku, dan waktunya", async () => {
    const penetapan = await testDb.roleAssignment.findFirstOrThrow({
      where: { userId: pengurusLama.userId },
    });
    const selesaiLama = penetapan.endDate;

    const hasil = await overrideRolePeriod({
      actor: admin.actor,
      roleAssignmentId: penetapan.id,
      newEndDate: SERAH_TERIMA,
      reason: "Perpanjangan untuk menuntaskan serah terima keuangan.",
    });

    expect(hasil.ok).toBe(true);

    const jejak = await testDb.auditLog.findFirst({
      where: {
        action: AUDIT_ACTIONS.MEMBER_ROLE_PERIOD_OVERRIDDEN,
        objectType: AUDIT_OBJECTS.USER,
        objectId: pengurusLama.userId,
      },
      orderBy: { createdAt: "desc" },
    });

    expect(jejak).not.toBeNull();
    expect(jejak?.actorId).toBe(admin.userId);
    expect(jejak?.reason).toContain("serah terima keuangan");
    expect(jejak?.before).toMatchObject({
      selesai: selesaiLama?.toISOString() ?? null,
    });
    expect(jejak?.after).toMatchObject({ selesai: SERAH_TERIMA.toISOString() });
    expect(jejak?.createdAt).toBeInstanceOf(Date);
  });

  it("Tanggal selesai sebelum tanggal mulai ditolak", async () => {
    const penetapan = await testDb.roleAssignment.findFirstOrThrow({
      where: { userId: pengurusLama.userId },
    });

    const hasil = await overrideRolePeriod({
      actor: admin.actor,
      roleAssignmentId: penetapan.id,
      newEndDate: new Date("2020-01-01T00:00:00.000Z"),
      reason: "Sengaja salah untuk menguji penolakan.",
    });

    expect(hasil.ok).toBe(false);
  });
});

describe("F07 Serah terima jabatan menutup masa jabatan lama dan membuka masa jabatan baru dalam satu langkah.", () => {
  it("UAT-HAND-001, serah terima menutup yang lama dan membuka yang baru sekaligus", async () => {
    const penetapanLama = await testDb.roleAssignment.findFirstOrThrow({
      where: { userId: pengurusLama.userId, role: "FINANCE_POC" },
    });

    const hasil = await handoverRole({
      actor: admin.actor,
      fromRoleAssignmentId: penetapanLama.id,
      toUserId: pengurusBaru.userId,
      effectiveAt: SERAH_TERIMA,
      newPeriod: "2027/2028",
      reason: "Pergantian kepengurusan tahunan.",
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;

    const ditutup = await testDb.roleAssignment.findUniqueOrThrow({
      where: { id: penetapanLama.id },
    });
    const dibuka = await testDb.roleAssignment.findUniqueOrThrow({
      where: { id: hasil.newRoleAssignmentId },
    });

    expect(ditutup.endDate?.toISOString()).toBe(SERAH_TERIMA.toISOString());
    expect(dibuka.startDate.toISOString()).toBe(SERAH_TERIMA.toISOString());
    expect(dibuka.role).toBe("FINANCE_POC");
    expect(dibuka.userId).toBe(pengurusBaru.userId);
  });

  it("UAT-HAND-002, pengurus lama kehilangan kewenangan tepat pada tanggal serah terima", async () => {
    const lama = await reloadActor(pengurusLama.userId);

    const sebelum = checkPermission({
      actor: lama,
      action: "finance.view",
      now: new Date(SERAH_TERIMA.getTime() - 1),
    });
    const sesudah = checkPermission({
      actor: lama,
      action: "finance.view",
      now: SERAH_TERIMA,
    });

    expect(sebelum.allowed).toBe(true);
    expect(sesudah.allowed).toBe(false);
  });

  it("Pengurus baru memperoleh kewenangan tepat pada tanggal yang sama, tanpa celah", async () => {
    const baru = await reloadActor(pengurusBaru.userId);

    const hasil = checkPermission({
      actor: baru,
      action: "finance.view",
      now: SERAH_TERIMA,
    });

    expect(hasil.allowed).toBe(true);
  });

  it("UAT-HAND-003, riwayat pengurus lama tidak terhapus", async () => {
    const penetapan = await testDb.roleAssignment.findMany({
      where: { userId: pengurusLama.userId },
    });

    expect(penetapan.length).toBeGreaterThan(0);

    const jejak = await testDb.auditLog.findFirst({
      where: {
        action: AUDIT_ACTIONS.MEMBER_HANDOVER,
        objectId: pengurusLama.userId,
      },
    });
    expect(jejak).not.toBeNull();
    expect(jejak?.after).toMatchObject({ pemegang: pengurusBaru.userId });
  });

  it("Serah terima tanpa alasan ditolak", async () => {
    const penetapan = await testDb.roleAssignment.findFirstOrThrow({
      where: { userId: pengurusBaru.userId, role: "PROJECT_MANAGER" },
    });

    const hasil = await handoverRole({
      actor: admin.actor,
      fromRoleAssignmentId: penetapan.id,
      toUserId: coo.userId,
      effectiveAt: SERAH_TERIMA,
      newPeriod: "2027/2028",
      reason: "",
    });

    expect(hasil.ok).toBe(false);
  });
});

describe("F07 Penonaktifan akun mencabut seluruh sesinya seketika.", () => {
  it("Penonaktifan mencabut sesi yang masih berjalan", async () => {
    const korban = await actorFrom(
      uniqueEmail(`${PREFIX}nonaktif-`),
      "PROJECT_MANAGER",
      "OPERATIONAL",
    );

    await testDb.session.create({
      data: {
        tokenHash: `hash-${korban.userId}`,
        userId: korban.userId,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000),
      },
    });

    const hasil = await deactivateUser({
      actor: admin.actor,
      userId: korban.userId,
      reason: "Mengundurkan diri dari kepengurusan.",
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;
    expect(hasil.revokedSessions).toBe(1);

    const sesi = await testDb.session.findFirstOrThrow({
      where: { userId: korban.userId },
    });
    expect(sesi.revokedAt).not.toBeNull();

    const user = await testDb.user.findUniqueOrThrow({
      where: { id: korban.userId },
    });
    expect(user.status).toBe("DEACTIVATED");
  });

  it("Penonaktifan tanpa alasan ditolak", async () => {
    const hasil = await deactivateUser({
      actor: admin.actor,
      userId: coo.userId,
      reason: "",
    });

    expect(hasil.ok).toBe(false);
  });
});
