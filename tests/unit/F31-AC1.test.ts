import { describe, expect, it } from "vitest";
import {
  canAssignToDivision,
  divisionGovernedBy,
} from "@/lib/project/assignment-rules";
import { actor, assignment, NOW } from "../support/factories";

describe("F31-AC1 C-Level hanya bisa menugaskan staf dari domainnya sendiri, dan pilihan lintas domain ditolak.", () => {
  it("Setiap C-Level memerintah tepat satu divisi", () => {
    expect(divisionGovernedBy("COO")).toBe("OPERATIONAL");
    expect(divisionGovernedBy("VICE_COO")).toBe("OPERATIONAL");
    expect(divisionGovernedBy("CFO")).toBe("FINANCE");
    expect(divisionGovernedBy("VICE_CFO")).toBe("FINANCE");
    expect(divisionGovernedBy("CTO")).toBe("TECHDEV");
    expect(divisionGovernedBy("VICE_CTO")).toBe("TECHDEV");
  });

  it("Jabatan yang bukan C-Level tidak memerintah divisi mana pun", () => {
    for (const role of [
      "PROJECT_MANAGER",
      "FINANCE_POC",
      "OFFICER_OPERATIONAL",
      "TECHDEV_MEMBER",
    ] as const) {
      expect(divisionGovernedBy(role)).toBeNull();
    }
  });

  it("COO dapat menugaskan pelaksana Operational", () => {
    expect(canAssignToDivision(actor("COO"), "OPERATIONAL", NOW)).toBe(true);
  });

  it("COO tidak dapat menugaskan pelaksana Finance maupun TechDev", () => {
    expect(canAssignToDivision(actor("COO"), "FINANCE", NOW)).toBe(false);
    expect(canAssignToDivision(actor("COO"), "TECHDEV", NOW)).toBe(false);
  });

  it("CFO hanya dapat menugaskan pelaksana Finance", () => {
    expect(canAssignToDivision(actor("CFO"), "FINANCE", NOW)).toBe(true);
    expect(canAssignToDivision(actor("CFO"), "OPERATIONAL", NOW)).toBe(false);
  });

  it("CTO hanya dapat menugaskan pelaksana TechDev", () => {
    expect(canAssignToDivision(actor("CTO"), "TECHDEV", NOW)).toBe(true);
    expect(canAssignToDivision(actor("CTO"), "FINANCE", NOW)).toBe(false);
  });

  it("Wakil punya kewenangan menugaskan yang sama dengan pejabat utamanya", () => {
    expect(canAssignToDivision(actor("VICE_CFO"), "FINANCE", NOW)).toBe(true);
  });

  it("Seseorang yang memegang dua jabatan C-Level dapat menugaskan di kedua domainnya", () => {
    const rangkap = actor("COO", {
      roleAssignments: [assignment("COO"), assignment("CTO")],
    });

    expect(canAssignToDivision(rangkap, "OPERATIONAL", NOW)).toBe(true);
    expect(canAssignToDivision(rangkap, "TECHDEV", NOW)).toBe(true);
    expect(canAssignToDivision(rangkap, "FINANCE", NOW)).toBe(false);
  });

  it("Project Manager tidak dapat menugaskan siapa pun", () => {
    for (const divisi of ["OPERATIONAL", "FINANCE", "TECHDEV"] as const) {
      expect(canAssignToDivision(actor("PROJECT_MANAGER"), divisi, NOW)).toBe(
        false,
      );
    }
  });

  it("C-Level yang masa jabatannya sudah lewat tidak dapat menugaskan siapa pun", () => {
    const mantanCoo = actor("COO", {
      roleAssignments: [
        assignment("COO", { endDate: new Date("2026-09-01T00:00:00.000Z") }),
      ],
    });

    expect(canAssignToDivision(mantanCoo, "OPERATIONAL", NOW)).toBe(false);
  });

  it("Akun yang tidak aktif tidak dapat menugaskan walau jabatannya cocok", () => {
    expect(
      canAssignToDivision(
        actor("COO", { status: "DEACTIVATED" }),
        "OPERATIONAL",
        NOW,
      ),
    ).toBe(false);
  });
});
