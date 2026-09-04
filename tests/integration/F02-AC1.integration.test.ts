import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import { hashPassword } from "@/lib/auth/password";
import { attemptLogin } from "@/server/auth/login";
import { cleanUpUsers, testDb } from "../support/database";

const PREFIX = "f02-ac1-";
const EMAIL = `${PREFIX}pm@iit.test`;
const PASSWORD = "kataSandiYangBenar123";

let userId: string;

beforeAll(async () => {
  await cleanUpUsers(PREFIX);
  const user = await testDb.user.create({
    data: {
      email: EMAIL,
      name: "Penguji PM",
      status: "ACTIVE",
      passwordHash: await hashPassword(PASSWORD),
      roleAssignments: {
        create: {
          role: "PROJECT_MANAGER",
          division: "OPERATIONAL",
          period: "2026/2027",
          startDate: new Date("2026-08-01T00:00:00.000Z"),
          endDate: new Date("2027-08-01T00:00:00.000Z"),
        },
      },
    },
  });
  userId = user.id;
});

afterAll(async () => {
  await cleanUpUsers(PREFIX);
  await testDb.$disconnect();
});

async function auditFor(action: string) {
  return testDb.auditLog.findMany({
    where: { action, objectId: userId },
    orderBy: { createdAt: "desc" },
  });
}

describe("F02-AC1 Kredensial salah ditolak tanpa membocorkan informasi.", () => {
  it("UAT-AUTH-005, kredensial benar diterima dan keberhasilannya meninggalkan jejak", async () => {
    const result = await attemptLogin({
      email: EMAIL,
      password: PASSWORD,
      ipAddress: "10.0.0.1",
      now: new Date("2026-09-04T03:00:00.000Z"),
    });

    expect(result.authenticated).toBe(true);

    const entries = await auditFor(AUDIT_ACTIONS.AUTH_LOGIN_SUCCESS);
    expect(entries).toHaveLength(1);
    expect(entries[0].actorId).toBe(userId);
    expect(entries[0].ipAddress).toBe("10.0.0.1");
    expect(entries[0].createdAt).toBeInstanceOf(Date);
  });

  it("UAT-AUTH-006, kata sandi salah ditolak dan penolakannya meninggalkan jejak", async () => {
    const result = await attemptLogin({
      email: EMAIL,
      password: "kataSandiYangSalah",
      now: new Date("2026-09-04T03:00:00.000Z"),
    });

    expect(result.authenticated).toBe(false);

    const entries = await auditFor(AUDIT_ACTIONS.AUTH_LOGIN_FAILED);
    expect(entries).toHaveLength(1);
    expect(entries[0].actorId).toBe(userId);
  });

  it("Email yang tidak terdaftar tidak membuat entri bernama, tetapi tetap tercatat", async () => {
    const sebelum = await testDb.auditLog.count({
      where: { action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED, actorId: null },
    });

    const result = await attemptLogin({
      email: `${PREFIX}tidak-ada@iit.test`,
      password: PASSWORD,
      now: new Date("2026-09-04T03:00:00.000Z"),
    });

    expect(result.authenticated).toBe(false);

    const sesudah = await testDb.auditLog.count({
      where: { action: AUDIT_ACTIONS.AUTH_LOGIN_FAILED, actorId: null },
    });
    expect(sesudah).toBe(sebelum + 1);
  });

  it("Email tidak terdaftar dan kata sandi salah menghasilkan penolakan yang sama persis", async () => {
    const now = new Date("2026-09-04T03:00:00.000Z");
    const emailAsing = await attemptLogin({
      email: `${PREFIX}asing@iit.test`,
      password: PASSWORD,
      now,
    });
    const sandiSalah = await attemptLogin({
      email: EMAIL,
      password: "salah-lagi",
      now,
    });

    if (emailAsing.authenticated || sandiSalah.authenticated) {
      throw new Error("Keduanya seharusnya ditolak");
    }
    expect(emailAsing.reason).toBe(sandiSalah.reason);
  });
});
