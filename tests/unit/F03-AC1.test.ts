import { describe, expect, it } from "vitest";
import { checkPermission } from "@/lib/auth/permissions";
import {
  actor,
  assignedProject,
  assignment,
  foreignProject,
  NOW,
} from "../support/factories";

describe("F03-AC1 Setiap permintaan diperiksa terhadap jabatan aktif dan penugasan project di lapisan server.", () => {
  it("UAT-RBAC-006, PM yang ditugaskan otomatis memperoleh hak edit Operational tanpa konfigurasi permission manual", () => {
    const decision = checkPermission({
      actor: actor("PROJECT_MANAGER"),
      action: "project.edit_operational",
      project: assignedProject("OPERATIONAL"),
      now: NOW,
    });

    expect(decision.allowed).toBe(true);
  });

  it("UAT-RBAC-001, PM non-assignee tetap dapat melihat informasi inti project", () => {
    const decision = checkPermission({
      actor: actor("PROJECT_MANAGER"),
      action: "project.view",
      project: foreignProject(),
      now: NOW,
    });

    expect(decision.allowed).toBe(true);
  });

  it("UAT-RBAC-001, PM non-assignee tidak dapat mengubah data Operational project tersebut", () => {
    const decision = checkPermission({
      actor: actor("PROJECT_MANAGER"),
      action: "project.edit_operational",
      project: foreignProject(),
      now: NOW,
    });

    expect(decision.allowed).toBe(false);
  });

  it("UAT-RBAC-002, PM tidak dapat melakukan final Finance approval", () => {
    const decision = checkPermission({
      actor: actor("PROJECT_MANAGER"),
      action: "finance.approve_final",
      project: assignedProject("OPERATIONAL"),
      now: NOW,
    });

    expect(decision.allowed).toBe(false);
  });

  it("UAT-RBAC-003, CFO dapat melakukan final Finance approval", () => {
    const decision = checkPermission({
      actor: actor("CFO"),
      action: "finance.approve_final",
      project: foreignProject(),
      now: NOW,
    });

    expect(decision.allowed).toBe(true);
  });

  it("UAT-RBAC-004, CTO dapat menetapkan SDM dan jabatan lain tidak dapat", () => {
    expect(
      checkPermission({
        actor: actor("CTO"),
        action: "staffing.approve",
        project: foreignProject(),
        now: NOW,
      }).allowed,
    ).toBe(true);

    expect(
      checkPermission({
        actor: actor("PROJECT_MANAGER"),
        action: "staffing.approve",
        project: assignedProject("OPERATIONAL"),
        now: NOW,
      }).allowed,
    ).toBe(false);
  });

  it("UAT-RBAC-005, Authorized TechDev dapat mengelola user dan role", () => {
    const authorizedTechDev = actor("TECHDEV_MEMBER", {
      roleAssignments: [assignment("TECHDEV_MEMBER", { isSystemAdmin: true })],
    });

    for (const action of [
      "user.invite",
      "user.deactivate",
      "user.manage_role_assignment",
    ] as const) {
      expect(
        checkPermission({ actor: authorizedTechDev, action, now: NOW }).allowed,
      ).toBe(true);
    }
  });

  it("System Administrator privilege tidak memberi wewenang menyetujui pengajuan bisnis maupun mengubah data Finance", () => {
    const authorizedTechDev = actor("TECHDEV_MEMBER", {
      roleAssignments: [assignment("TECHDEV_MEMBER", { isSystemAdmin: true })],
    });

    for (const action of [
      "finance.approve_final",
      "finance.edit",
      "approval.project_value_scope",
    ] as const) {
      expect(
        checkPermission({
          actor: authorizedTechDev,
          action,
          project: assignedProject("TECHDEV"),
          now: NOW,
        }).allowed,
      ).toBe(false);
    }
  });

  it("Pelaksana Finance hanya dapat mengubah domain Finance, domain Operational berstatus lihat saja", () => {
    const financePoc = actor("FINANCE_POC");

    expect(
      checkPermission({
        actor: financePoc,
        action: "finance.edit",
        project: assignedProject("FINANCE"),
        now: NOW,
      }).allowed,
    ).toBe(true);

    expect(
      checkPermission({
        actor: financePoc,
        action: "project.edit_operational",
        project: assignedProject("FINANCE"),
        now: NOW,
      }).allowed,
    ).toBe(false);
  });

  it("COO memegang kewenangan penuh master data dan stage tanpa perlu ditugaskan pada project", () => {
    for (const action of [
      "project.edit_operational",
      "stage.change",
      "project.override_id",
      "project.assign_pm",
    ] as const) {
      expect(
        checkPermission({
          actor: actor("COO"),
          action,
          project: foreignProject(),
          now: NOW,
        }).allowed,
      ).toBe(true);
    }
  });

  it("Penolakan menyebutkan alasan dalam bahasa pengguna, bukan kode kesalahan", () => {
    const decision = checkPermission({
      actor: actor("PROJECT_MANAGER"),
      action: "finance.approve_final",
      project: assignedProject("OPERATIONAL"),
      now: NOW,
    });

    expect(decision.allowed).toBe(false);
    if (decision.allowed) return;
    expect(decision.reason).toMatch(/[a-z]{4,}\s+[a-z]{4,}/i);
    expect(decision.reason).not.toMatch(/^[A-Z0-9_]+$/);
  });
});
