import { describe, expect, it } from "vitest";
import {
  canEditTab,
  canGlobally,
  canOnProject,
  canSeeAmounts,
  canSeeContractLink,
  myProjectRole,
  type ProjectAction,
  seesAllProjects,
} from "@/lib/auth/access";
import { activeRole } from "@/lib/auth/period";
import type { RoleName } from "@/lib/auth/types";
import {
  access,
  actor,
  assignment,
  DEV_ID,
  DEV2_ID,
  FIN_ID,
  NOW,
  PM_ID,
  viewer,
} from "../support/factories";

function allowed(
  role: RoleName | null,
  userId: string,
  action: ProjectAction,
  overrides = {},
): boolean {
  return canOnProject(viewer(role, userId), action, access(overrides)).allowed;
}

describe("PRD 2.4: matriks hak akses per bagian", () => {
  it("hanya COO dan Vice COO yang bisa menambah project dan mengganti PM", () => {
    expect(canGlobally(viewer("COO"), "project.create").allowed).toBe(true);
    expect(canGlobally(viewer("VICE_COO"), "project.create").allowed).toBe(
      true,
    );
    for (const role of [
      "PROJECT_MANAGER",
      "CTO",
      "CFO",
      "SUPER_ADMIN",
    ] as const) {
      expect(canGlobally(viewer(role), "project.create").allowed).toBe(false);
    }
    expect(allowed("COO", "c", "project.assignPm")).toBe(true);
    expect(allowed("PROJECT_MANAGER", PM_ID, "project.assignPm")).toBe(false);
  });

  it("isian Operasional hanya bisa diubah PM yang ditugaskan, bukan PM lain atau COO", () => {
    for (const action of [
      "stage1.edit",
      "charter.edit",
      "mou.edit",
      "staffing.submit",
      "contract.edit",
      "ops.edit",
    ] as const) {
      expect(allowed("PROJECT_MANAGER", PM_ID, action)).toBe(true);
      expect(allowed("PROJECT_MANAGER", "pm-lain", action)).toBe(false);
      expect(allowed("COO", "coo", action)).toBe(false);
    }
  });

  it("Project Charter dan MoU diputuskan COO/VCOO, Kontrak Programmer oleh CTO/VCTO", () => {
    expect(allowed("COO", "c", "charter.decide")).toBe(true);
    expect(allowed("VICE_COO", "c", "mou.decide")).toBe(true);
    expect(allowed("CTO", "c", "mou.decide")).toBe(false);
    expect(allowed("PROJECT_MANAGER", PM_ID, "charter.decide")).toBe(false);
    expect(allowed("VICE_CTO", "c", "contract.decide")).toBe(true);
    expect(allowed("COO", "c", "contract.decide")).toBe(false);
  });

  it("termin diubah PM sebelum MoU ditandatangani, sesudahnya hanya CFO/VCFO", () => {
    expect(allowed("PROJECT_MANAGER", PM_ID, "terms.edit")).toBe(true);
    expect(allowed("CFO", "c", "terms.edit")).toBe(false);
    expect(
      allowed("PROJECT_MANAGER", PM_ID, "terms.edit", { mouSigned: true }),
    ).toBe(false);
    expect(allowed("VICE_CFO", "c", "terms.edit", { mouSigned: true })).toBe(
      true,
    );
  });

  it("data teknis diubah developer yang ditugaskan atau CTO/VCTO", () => {
    expect(allowed("TECH_DEVELOPER", DEV_ID, "tech.edit")).toBe(true);
    expect(allowed("TECH_DEVELOPER", DEV2_ID, "tech.edit")).toBe(false);
    expect(allowed("CTO", "c", "tech.edit")).toBe(true);
    expect(allowed("PROJECT_MANAGER", PM_ID, "tech.edit")).toBe(false);
  });

  it("status termin diubah Finance POC project, dengan CFO/VCFO sebagai cadangan", () => {
    expect(allowed("FINANCE_POC", FIN_ID, "term.finance")).toBe(true);
    expect(allowed("FINANCE_POC", "fin-lain", "term.finance")).toBe(false);
    expect(allowed("CFO", "c", "term.finance")).toBe(true);
    expect(allowed("PROJECT_MANAGER", PM_ID, "term.finance")).toBe(false);
    expect(allowed("PROJECT_MANAGER", PM_ID, "term.pm")).toBe(true);
  });

  it("Finance POC ditunjuk CFO/VCFO, developer ditugaskan CTO/VCTO", () => {
    expect(allowed("CFO", "c", "financePoc.assign")).toBe(true);
    expect(allowed("FINANCE_POC", FIN_ID, "financePoc.assign")).toBe(false);
    expect(allowed("CTO", "c", "developer.assign")).toBe(true);
    expect(allowed("PROJECT_MANAGER", PM_ID, "developer.assign")).toBe(false);
  });

  it("Finance Disbursement: PM mengajukan, Finance POC memverifikasi, CFO/VCFO memutuskan", () => {
    expect(allowed("PROJECT_MANAGER", PM_ID, "disbursement.submit")).toBe(true);
    expect(allowed("FINANCE_POC", FIN_ID, "disbursement.finance")).toBe(true);
    expect(allowed("FINANCE_POC", FIN_ID, "disbursement.decide")).toBe(false);
    expect(allowed("VICE_CFO", "c", "disbursement.decide")).toBe(true);
  });

  it("project ditandai selesai oleh PM atau COO/VCOO", () => {
    expect(allowed("PROJECT_MANAGER", PM_ID, "project.close")).toBe(true);
    expect(allowed("COO", "c", "project.close")).toBe(true);
    expect(allowed("CFO", "c", "project.close")).toBe(false);
  });

  it("Super Admin tidak bisa mengedit data project, menugaskan, atau menyetujui", () => {
    for (const action of [
      "project.assignPm",
      "charter.decide",
      "developer.assign",
      "term.finance",
      "ops.edit",
    ] as const) {
      const decision = canOnProject(
        viewer("SUPER_ADMIN", PM_ID),
        action,
        access(),
      );
      expect(decision.allowed).toBe(false);
    }
    expect(canGlobally(viewer("SUPER_ADMIN"), "users.manage").allowed).toBe(
      true,
    );
    expect(canGlobally(viewer("COO"), "users.manage").allowed).toBe(false);
    expect(canGlobally(viewer("COO"), "users.view").allowed).toBe(true);
    expect(canGlobally(viewer("PROJECT_MANAGER"), "users.view").allowed).toBe(
      false,
    );
  });

  it("project yang sudah ditutup read-only untuk semua jabatan", () => {
    const decision = canOnProject(
      viewer("PROJECT_MANAGER", PM_ID),
      "ops.edit",
      access({ closed: true }),
    );
    expect(decision).toEqual({
      allowed: false,
      reason: "Project sudah ditutup dan bersifat read-only.",
    });
    expect(allowed("COO", "c", "project.assignPm", { closed: true })).toBe(
      false,
    );
  });

  it("penolakan selalu menyebut alasannya", () => {
    const decision = canOnProject(viewer("CTO", "c"), "mou.decide", access());
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.reason).toMatch(/COO/);
  });
});

describe("PRD 2.4: aturan visibilitas", () => {
  it("nominal dan tautan MoU terlihat oleh PM, C-Level, dan Finance POC project itu saja", () => {
    const p = access();
    expect(canSeeAmounts(viewer("PROJECT_MANAGER", PM_ID), p)).toBe(true);
    expect(canSeeAmounts(viewer("FINANCE_POC", FIN_ID), p)).toBe(true);
    expect(canSeeAmounts(viewer("CTO", "c"), p)).toBe(true);
    expect(canSeeAmounts(viewer("TECH_DEVELOPER", DEV_ID), p)).toBe(false);
    expect(canSeeAmounts(viewer("SUPER_ADMIN", "a"), p)).toBe(false);
    expect(canSeeAmounts(viewer("PROJECT_MANAGER", "pm-lain"), p)).toBe(false);
    expect(canSeeAmounts(viewer("FINANCE_POC", "fin-lain"), p)).toBe(false);
  });

  it("tautan Kontrak Programmer terlihat oleh PM, developer bersangkutan, CTO/VCTO, dan CFO/VCFO", () => {
    const p = access({ developerUserIds: [DEV_ID, DEV2_ID] });
    expect(
      canSeeContractLink(viewer("TECH_DEVELOPER", DEV_ID), p, DEV_ID),
    ).toBe(true);
    expect(
      canSeeContractLink(viewer("TECH_DEVELOPER", DEV2_ID), p, DEV_ID),
    ).toBe(false);
    expect(
      canSeeContractLink(viewer("PROJECT_MANAGER", PM_ID), p, DEV_ID),
    ).toBe(true);
    expect(canSeeContractLink(viewer("VICE_CTO", "c"), p, DEV_ID)).toBe(true);
    expect(canSeeContractLink(viewer("CFO", "c"), p, DEV_ID)).toBe(true);
    expect(canSeeContractLink(viewer("COO", "c"), p, DEV_ID)).toBe(false);
    expect(canSeeContractLink(viewer("SUPER_ADMIN", "a"), p, DEV_ID)).toBe(
      false,
    );
  });

  it("tab divisi hanya bisa diedit oleh pemilik divisinya di project itu", () => {
    const p = access();
    expect(canEditTab(viewer("PROJECT_MANAGER", PM_ID), p, "pm")).toBe(true);
    expect(canEditTab(viewer("COO", "c"), p, "pm")).toBe(false);
    expect(canEditTab(viewer("TECH_DEVELOPER", DEV_ID), p, "tech")).toBe(true);
    expect(canEditTab(viewer("CFO", "c"), p, "finance")).toBe(true);
    expect(canEditTab(viewer("SUPER_ADMIN", "a"), p, "finance")).toBe(false);
  });

  it("C-Level dan Super Admin melihat semua project, jabatan lain hanya yang ditugaskan", () => {
    expect(seesAllProjects("COO")).toBe(true);
    expect(seesAllProjects("VICE_CFO")).toBe(true);
    expect(seesAllProjects("SUPER_ADMIN")).toBe(true);
    expect(seesAllProjects("PROJECT_MANAGER")).toBe(false);
    expect(seesAllProjects("FINANCE_POC")).toBe(false);
  });

  it("kolom Peranku mengutamakan peran penugasan di project", () => {
    const p = access();
    expect(myProjectRole(viewer("PROJECT_MANAGER", PM_ID), p)).toBe("PM");
    expect(myProjectRole(viewer("TECH_DEVELOPER", DEV_ID), p)).toBe(
      "DEVELOPER",
    );
    expect(myProjectRole(viewer("FINANCE_POC", FIN_ID), p)).toBe("FINANCE_POC");
    expect(myProjectRole(viewer("CTO", "c"), p)).toBe("C_LEVEL");
    expect(myProjectRole(viewer("PROJECT_MANAGER", "lain"), p)).toBeNull();
  });
});

describe("PRD 2.1: satu jabatan aktif per akun", () => {
  it("jabatan terbaru yang berlaku, dan akun nonaktif tidak punya jabatan", () => {
    const promoted = actor("PROJECT_MANAGER", {
      roleAssignments: [
        assignment("PROJECT_MANAGER", {
          endDate: new Date("2026-09-01T00:00:00+07:00"),
        }),
        assignment("VICE_COO", {
          startDate: new Date("2026-09-01T00:00:00+07:00"),
        }),
      ],
    });
    expect(activeRole(promoted, NOW)).toBe("VICE_COO");
    expect(activeRole({ ...promoted, status: "INACTIVE" }, NOW)).toBeNull();
  });

  it("akses berhenti tepat pada akhir periode", () => {
    const pm = actor("PROJECT_MANAGER");
    const end = pm.roleAssignments[0].endDate;
    expect(activeRole(pm, new Date(end.getTime() - 1))).toBe("PROJECT_MANAGER");
    expect(activeRole(pm, end)).toBeNull();
  });
});
