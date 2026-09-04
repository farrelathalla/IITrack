import { describe, expect, it } from "vitest";
import { evaluateSession } from "@/lib/auth/session";
import { assignment, NOW, PERIOD_END } from "../support/factories";

const LATER = new Date(NOW.getTime() + 60 * 60 * 1000);

function activeSession() {
  return { expiresAt: LATER, revokedAt: null };
}

function activeUser() {
  return {
    status: "ACTIVE" as const,
    roleAssignments: [assignment("PROJECT_MANAGER")],
  };
}

describe("F02-AC3 Sesi berakhir seketika ketika masa jabatan habis atau akun dinonaktifkan.", () => {
  it("Sesi yang masih berlaku pada pengguna aktif tetap dapat dipakai", () => {
    const result = evaluateSession({
      session: activeSession(),
      user: activeUser(),
      now: NOW,
    });

    expect(result.valid).toBe(true);
  });

  it("Sesi berakhir seketika ketika akun dinonaktifkan, tanpa menunggu masa berlakunya habis", () => {
    const result = evaluateSession({
      session: activeSession(),
      user: { ...activeUser(), status: "DEACTIVATED" },
      now: NOW,
    });

    expect(result.valid).toBe(false);
  });

  it("Sesi berakhir seketika ketika masa jabatan habis, tanpa menunggu masa berlakunya habis", () => {
    const afterTenure = new Date(PERIOD_END.getTime() + 1);

    const result = evaluateSession({
      session: {
        expiresAt: new Date(afterTenure.getTime() + 60 * 60 * 1000),
        revokedAt: null,
      },
      user: activeUser(),
      now: afterTenure,
    });

    expect(result.valid).toBe(false);
  });

  it("Sesi yang sudah lewat masa berlakunya ditolak", () => {
    const result = evaluateSession({
      session: { expiresAt: new Date(NOW.getTime() - 1), revokedAt: null },
      user: activeUser(),
      now: NOW,
    });

    expect(result.valid).toBe(false);
  });

  it("Alasan berakhirnya sesi ditulis dalam bahasa pengguna", () => {
    const result = evaluateSession({
      session: activeSession(),
      user: { ...activeUser(), status: "DEACTIVATED" },
      now: NOW,
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.reason.split(" ").length).toBeGreaterThan(3);
  });
});
