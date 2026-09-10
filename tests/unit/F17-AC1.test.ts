import { describe, expect, it } from "vitest";
import {
  APPROVAL_CHAINS,
  buildApprovalChain,
  eligibleRolesForStep,
  isEligibleApprover,
} from "@/lib/approval/chain";
import { actor, assignment, NOW } from "../support/factories";

describe("F17-AC1 Sistem menentukan approver dari jenis pengajuan dan jabatan, jadi pengaju tidak memilihnya sendiri.", () => {
  it("Rantai invoice melewati Finance POC, POC dokumentasi, lalu CFO", () => {
    const rantai = buildApprovalChain("INVOICE");

    expect(rantai.map((step) => step.order)).toEqual([1, 2, 3]);
    expect(rantai[0].eligibleRoles).toContain("FINANCE_POC");
    expect(rantai[1].eligibleRoles).toContain("OFFICER_OPERATIONAL");
    expect(rantai[2].eligibleRoles).toEqual(
      expect.arrayContaining(["CFO", "VICE_CFO"]),
    );
  });

  it("Rantai staffing request cukup satu langkah oleh CTO atau Vice CTO", () => {
    const rantai = buildApprovalChain("STAFFING_REQUEST");

    expect(rantai).toHaveLength(1);
    expect(rantai[0].eligibleRoles).toEqual(
      expect.arrayContaining(["CTO", "VICE_CTO"]),
    );
  });

  it("Rantai perubahan nilai dan scope project melewati COO atau Vice COO", () => {
    const rantai = buildApprovalChain("PROJECT_VALUE_CHANGE");

    expect(rantai).toHaveLength(1);
    expect(rantai[0].eligibleRoles).toEqual(
      expect.arrayContaining(["COO", "VICE_COO"]),
    );
  });

  it("Rantai selalu berurutan mulai dari satu tanpa lompatan", () => {
    for (const jenis of Object.keys(APPROVAL_CHAINS) as Array<
      keyof typeof APPROVAL_CHAINS
    >) {
      const urutan = buildApprovalChain(jenis).map((step) => step.order);
      expect(urutan).toEqual(urutan.map((_, index) => index + 1));
    }
  });

  it("Setiap langkah punya sekurangnya satu jabatan yang berwenang", () => {
    for (const jenis of Object.keys(APPROVAL_CHAINS) as Array<
      keyof typeof APPROVAL_CHAINS
    >) {
      for (const step of buildApprovalChain(jenis)) {
        expect(step.eligibleRoles.length).toBeGreaterThan(0);
      }
    }
  });

  it("Rantai yang dikembalikan tidak bisa diubah pemanggilnya", () => {
    const rantai = buildApprovalChain("INVOICE");

    expect(() => {
      (rantai as unknown as { push: (value: unknown) => void }).push({});
    }).toThrow();
  });

  it("Jabatan yang tercantum pada langkah dinilai berwenang", () => {
    const cfo = actor("CFO");
    const langkah = buildApprovalChain("INVOICE")[2];

    expect(isEligibleApprover(cfo, langkah, NOW)).toBe(true);
  });

  it("Jabatan di luar langkah tidak dinilai berwenang, walau ia atasan di divisi lain", () => {
    const coo = actor("COO");
    const langkahFinance = buildApprovalChain("INVOICE")[2];

    expect(isEligibleApprover(coo, langkahFinance, NOW)).toBe(false);
  });

  it("Jabatan yang masa berlakunya sudah lewat tidak lagi berwenang menyetujui", () => {
    const mantanCfo = actor("CFO", {
      roleAssignments: [
        assignment("CFO", { endDate: new Date("2026-09-01T00:00:00.000Z") }),
      ],
    });
    const langkah = buildApprovalChain("INVOICE")[2];

    expect(isEligibleApprover(mantanCfo, langkah, NOW)).toBe(false);
  });

  it("Akun yang tidak aktif tidak berwenang menyetujui walau jabatannya cocok", () => {
    const cfoNonaktif = actor("CFO", { status: "DEACTIVATED" });
    const langkah = buildApprovalChain("INVOICE")[2];

    expect(isEligibleApprover(cfoNonaktif, langkah, NOW)).toBe(false);
  });

  it("Daftar jabatan berwenang sebuah langkah bisa dibaca tanpa menyusun ulang rantainya", () => {
    expect(eligibleRolesForStep("STAFFING_REQUEST", 1)).toEqual(
      expect.arrayContaining(["CTO", "VICE_CTO"]),
    );
  });

  it("Langkah yang tidak ada dikembalikan kosong, bukan ditebak", () => {
    expect(eligibleRolesForStep("STAFFING_REQUEST", 99)).toEqual([]);
  });
});
