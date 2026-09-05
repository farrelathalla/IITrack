import { describe, expect, it } from "vitest";
import {
  alasanFromSessionEnd,
  LOGIN_NOTICES,
  noticeForAlasan,
} from "@/lib/auth/login-notice";
import { evaluateSession } from "@/lib/auth/session";
import { assignment, NOW, PERIOD_END } from "../support/factories";

const LATER = new Date(NOW.getTime() + 60 * 60 * 1000);

/**
 * F02-T03 — halaman masuk menampilkan pesan yang jelas ketika sesi berakhir.
 * Pemetaan kode mesin → teks diuji di sini tanpa merender React.
 */
describe("F02-T03 Halaman masuk menampilkan pesan jelas saat sesi berakhir.", () => {
  it("Kode alasan yang dikenal menghasilkan teks pemberitahuan", () => {
    expect(noticeForAlasan("logout")).toBe(LOGIN_NOTICES.logout);
    expect(noticeForAlasan("sesi")).toBe(LOGIN_NOTICES.sesi);
    expect(noticeForAlasan("jabatan")).toBe(LOGIN_NOTICES.jabatan);
    expect(noticeForAlasan("akun")).toBe(LOGIN_NOTICES.akun);
  });

  it("Kode alasan yang tidak dikenal atau kosong tidak menampilkan pesan", () => {
    expect(noticeForAlasan(undefined)).toBeUndefined();
    expect(noticeForAlasan("")).toBeUndefined();
    expect(noticeForAlasan("asal")).toBeUndefined();
  });

  it("Masa jabatan habis dipetakan ke alasan=jabatan", () => {
    const afterTenure = new Date(PERIOD_END.getTime() + 1);
    const result = evaluateSession({
      session: {
        expiresAt: new Date(afterTenure.getTime() + 60 * 60 * 1000),
        revokedAt: null,
      },
      user: {
        status: "ACTIVE",
        roleAssignments: [assignment("PROJECT_MANAGER")],
      },
      now: afterTenure,
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.code).toBe("no_assignment");
    expect(alasanFromSessionEnd(result.code)).toBe("jabatan");
    expect(noticeForAlasan("jabatan")).toContain("Masa jabatan");
  });

  it("Akun dinonaktifkan dipetakan ke alasan=akun", () => {
    const result = evaluateSession({
      session: { expiresAt: LATER, revokedAt: null },
      user: {
        status: "DEACTIVATED",
        roleAssignments: [assignment("PROJECT_MANAGER")],
      },
      now: NOW,
    });

    expect(result.valid).toBe(false);
    if (result.valid) return;
    expect(result.code).toBe("inactive");
    expect(alasanFromSessionEnd(result.code)).toBe("akun");
    expect(noticeForAlasan("akun")).toContain("dinonaktifkan");
  });

  it("Sesi dicabut atau kedaluwarsa dipetakan ke alasan=sesi", () => {
    const revoked = evaluateSession({
      session: { expiresAt: LATER, revokedAt: NOW },
      user: {
        status: "ACTIVE",
        roleAssignments: [assignment("PROJECT_MANAGER")],
      },
      now: new Date(NOW.getTime() + 1000),
    });
    expect(revoked.valid).toBe(false);
    if (!revoked.valid) {
      expect(alasanFromSessionEnd(revoked.code)).toBe("sesi");
    }

    const expired = evaluateSession({
      session: { expiresAt: new Date(NOW.getTime() - 1), revokedAt: null },
      user: {
        status: "ACTIVE",
        roleAssignments: [assignment("PROJECT_MANAGER")],
      },
      now: NOW,
    });
    expect(expired.valid).toBe(false);
    if (!expired.valid) {
      expect(alasanFromSessionEnd(expired.code)).toBe("sesi");
    }
  });
});
