import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { cleanUpUsers, testDb } from "../support/database";

const PREFIX = "f24-ac1-";

let actorId: string;

beforeAll(async () => {
  await cleanUpUsers(PREFIX);
  const user = await testDb.user.create({
    data: {
      email: `${PREFIX}coo@iit.test`,
      name: "Penguji COO",
      status: "ACTIVE",
    },
  });
  actorId = user.id;
});

afterAll(async () => {
  await cleanUpUsers(PREFIX);
  await testDb.$disconnect();
});

describe("F24-AC1 Entri memuat pelaku, aksi, objek, nilai sebelum, nilai sesudah, dan waktu.", () => {
  it("Entri menyimpan keenam bagian tersebut sekaligus", async () => {
    const entry = await testDb.auditLog.create({
      data: {
        actorId,
        action: AUDIT_ACTIONS.SESSION_REVOKED_BY_ADMIN,
        objectType: AUDIT_OBJECTS.USER,
        objectId: actorId,
        before: { status: "ACTIVE" },
        after: { status: "DEACTIVATED" },
        reason: "Pengujian isi entri",
      },
    });

    expect(entry.actorId).toBe(actorId);
    expect(entry.action).toBe(AUDIT_ACTIONS.SESSION_REVOKED_BY_ADMIN);
    expect(entry.objectType).toBe(AUDIT_OBJECTS.USER);
    expect(entry.objectId).toBe(actorId);
    expect(entry.before).toEqual({ status: "ACTIVE" });
    expect(entry.after).toEqual({ status: "DEACTIVATED" });
    expect(entry.createdAt).toBeInstanceOf(Date);
  });

  it("Pelaku boleh kosong untuk kejadian yang pelakunya belum teridentifikasi", async () => {
    const entry = await testDb.auditLog.create({
      data: {
        actorId: null,
        action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED,
        objectType: AUDIT_OBJECTS.USER,
      },
    });

    expect(entry.actorId).toBeNull();
    expect(entry.createdAt).toBeInstanceOf(Date);
  });

  it("Pengurus yang sudah punya riwayat tidak bisa dihapus, sehingga jejaknya tidak ikut hilang", async () => {
    const sementara = await testDb.user.create({
      data: {
        email: `${PREFIX}sementara@iit.test`,
        name: "Pengurus Lama",
        status: "ACTIVE",
      },
    });

    const entry = await testDb.auditLog.create({
      data: {
        actorId: sementara.id,
        action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
        objectType: AUDIT_OBJECTS.USER,
        objectId: sementara.id,
      },
    });

    await expect(
      testDb.user.delete({ where: { id: sementara.id } }),
    ).rejects.toThrow();

    const setelahnya = await testDb.auditLog.findUnique({
      where: { id: entry.id },
    });
    expect(setelahnya).not.toBeNull();
    expect(setelahnya?.actorId).toBe(sementara.id);
  });
});
