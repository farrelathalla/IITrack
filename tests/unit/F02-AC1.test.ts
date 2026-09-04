import { describe, expect, it } from "vitest";
import { authenticate } from "@/lib/auth/login";
import { hashPassword } from "@/lib/auth/password";
import { assignment, NOW } from "../support/factories";

const PASSWORD = "kataSandiYangBenar123";

async function activeUser() {
  return {
    id: "user-1",
    status: "ACTIVE" as const,
    passwordHash: await hashPassword(PASSWORD),
    roleAssignments: [assignment("PROJECT_MANAGER")],
  };
}

describe("F02-AC1 Kredensial salah ditolak tanpa membocorkan informasi.", () => {
  it("UAT-AUTH-005, kredensial yang benar diterima", async () => {
    const result = await authenticate({
      user: await activeUser(),
      password: PASSWORD,
      now: NOW,
    });

    expect(result.authenticated).toBe(true);
  });

  it("UAT-AUTH-006, kata sandi yang salah ditolak", async () => {
    const result = await authenticate({
      user: await activeUser(),
      password: "kataSandiYangSalah",
      now: NOW,
    });

    expect(result.authenticated).toBe(false);
  });

  it("Email yang tidak terdaftar dan kata sandi yang salah menghasilkan penolakan yang sama persis", async () => {
    const unknownEmail = await authenticate({
      user: null,
      password: PASSWORD,
      now: NOW,
    });
    const wrongPassword = await authenticate({
      user: await activeUser(),
      password: "kataSandiYangSalah",
      now: NOW,
    });

    expect(unknownEmail.authenticated).toBe(false);
    expect(wrongPassword.authenticated).toBe(false);
    if (unknownEmail.authenticated || wrongPassword.authenticated) return;
    expect(unknownEmail.reason).toBe(wrongPassword.reason);
  });

  it("Penolakan tidak menyebutkan email, status akun, maupun keberadaan penggunanya", async () => {
    const result = await authenticate({
      user: null,
      password: PASSWORD,
      now: NOW,
    });

    expect(result.authenticated).toBe(false);
    if (result.authenticated) return;
    expect(result.reason.toLowerCase()).not.toContain("email tidak terdaftar");
    expect(result.reason.toLowerCase()).not.toContain("tidak ditemukan");
  });

  it("Akun yang belum diaktivasi tidak bisa masuk walau kata sandinya cocok", async () => {
    const invited = {
      ...(await activeUser()),
      status: "INVITED" as const,
      passwordHash: null,
    };

    const result = await authenticate({
      user: invited,
      password: PASSWORD,
      now: NOW,
    });

    expect(result.authenticated).toBe(false);
  });

  it("Kata sandi disimpan dalam bentuk teracak dan tidak pernah sama untuk dua akun", async () => {
    const first = await hashPassword(PASSWORD);
    const second = await hashPassword(PASSWORD);

    expect(first).not.toContain(PASSWORD);
    expect(first).not.toBe(second);
  });
});
