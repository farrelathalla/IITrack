import { describe, expect, it } from "vitest";
import { evaluateSession } from "@/lib/auth/session";
import { assignment, NOW } from "../support/factories";

const LATER = new Date(NOW.getTime() + 60 * 60 * 1000);

function activeUser() {
  return {
    status: "ACTIVE" as const,
    roleAssignments: [assignment("PROJECT_MANAGER")],
  };
}

describe("F02-AC2 Setelah logout, tombol Back peramban tidak membuka halaman internal.", () => {
  it("UAT-AUTH-007, sesi yang sudah dicabut saat logout tidak bisa dipakai lagi", () => {
    const result = evaluateSession({
      session: { expiresAt: LATER, revokedAt: NOW },
      user: activeUser(),
      now: new Date(NOW.getTime() + 1000),
    });

    expect(result.valid).toBe(false);
  });

  it("Pencabutan berlaku sejak waktu logout, bukan sejak masa berlaku sesi habis", () => {
    const logoutAt = new Date(NOW.getTime() + 1000);
    const oneSecondAfterLogout = new Date(logoutAt.getTime() + 1000);

    const result = evaluateSession({
      session: { expiresAt: LATER, revokedAt: logoutAt },
      user: activeUser(),
      now: oneSecondAfterLogout,
    });

    expect(result.valid).toBe(false);
  });
});
