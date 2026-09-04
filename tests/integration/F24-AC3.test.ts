import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS, AUDIT_OBJECTS } from "@/lib/audit/actions";
import { cleanUpUsers, testDb } from "../support/database";

const PREFIX = "f24-ac3-";

let entryId: string;

beforeAll(async () => {
  await cleanUpUsers(PREFIX);
  const user = await testDb.user.create({
    data: {
      email: `${PREFIX}admin@iit.test`,
      name: "Authorized TechDev",
      status: "ACTIVE",
    },
  });
  const entry = await testDb.auditLog.create({
    data: {
      actorId: user.id,
      action: AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS,
      objectType: AUDIT_OBJECTS.USER,
      objectId: user.id,
      reason: "Entri asli",
    },
  });
  entryId = entry.id;
});

afterAll(async () => {
  await cleanUpUsers(PREFIX);
  await testDb.$disconnect();
});

describe("F24-AC3 Entri tidak bisa diubah maupun dihapus, termasuk oleh pemegang System Administrator privilege.", () => {
  it("UAT-NFR-003, percobaan mengubah entri ditolak basis data", async () => {
    await expect(
      testDb.auditLog.update({
        where: { id: entryId },
        data: { reason: "Dirapikan belakangan" },
      }),
    ).rejects.toThrow();
  });

  it("UAT-NFR-003, percobaan menghapus entri ditolak basis data", async () => {
    await expect(
      testDb.auditLog.delete({ where: { id: entryId } }),
    ).rejects.toThrow();
  });

  it("Penghapusan massal pun ditolak, bukan hanya penghapusan satu entri", async () => {
    await expect(
      testDb.auditLog.deleteMany({ where: { id: entryId } }),
    ).rejects.toThrow();
  });

  it("Entri tetap utuh dengan isi aslinya setelah seluruh percobaan di atas", async () => {
    const entry = await testDb.auditLog.findUnique({ where: { id: entryId } });

    expect(entry).not.toBeNull();
    expect(entry?.reason).toBe("Entri asli");
  });
});
