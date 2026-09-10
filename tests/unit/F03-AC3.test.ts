import { describe, expect, it } from "vitest";
import { checkPermission } from "@/lib/auth/permissions";
import {
  actor,
  assignedProject,
  assignment,
  foreignProject,
  NOW,
  PERIOD_END,
  PERIOD_START,
} from "../support/factories";

describe("F03-AC3 Jabatan yang periodenya lewat tidak memberi kewenangan apa pun.", () => {
  it("COO yang masa jabatannya sudah berakhir tidak lagi dapat mengubah stage", () => {
    const afterPeriod = new Date(PERIOD_END.getTime() + 1);

    const decision = checkPermission({
      actor: actor("COO"),
      action: "stage.change",
      project: assignedProject("OPERATIONAL"),
      now: afterPeriod,
    });

    expect(decision.allowed).toBe(false);
  });

  it("Kewenangan berhenti tepat pada tanggal berakhirnya masa jabatan, bukan sehari sesudahnya", () => {
    const oneMillisecondBeforeEnd = new Date(PERIOD_END.getTime() - 1);

    expect(
      checkPermission({
        actor: actor("COO"),
        action: "stage.change",
        project: assignedProject("OPERATIONAL"),
        now: oneMillisecondBeforeEnd,
      }).allowed,
    ).toBe(true);

    expect(
      checkPermission({
        actor: actor("COO"),
        action: "stage.change",
        project: assignedProject("OPERATIONAL"),
        now: PERIOD_END,
      }).allowed,
    ).toBe(false);
  });

  it("Jabatan yang masa berlakunya belum mulai tidak memberi kewenangan apa pun", () => {
    const beforePeriod = new Date(PERIOD_START.getTime() - 1);

    const decision = checkPermission({
      actor: actor("CFO"),
      action: "finance.approve_final",
      project: foreignProject(),
      now: beforePeriod,
    });

    expect(decision.allowed).toBe(false);
  });

  it("System Administrator privilege ikut berakhir bersama masa jabatannya", () => {
    const authorizedTechDev = actor("TECHDEV_MEMBER", {
      roleAssignments: [assignment("TECHDEV_MEMBER", { isSystemAdmin: true })],
    });

    const decision = checkPermission({
      actor: authorizedTechDev,
      action: "user.invite",
      now: new Date(PERIOD_END.getTime() + 1),
    });

    expect(decision.allowed).toBe(false);
  });

  it("Akun yang dinonaktifkan tidak berwenang walaupun masa jabatannya masih berjalan", () => {
    const decision = checkPermission({
      actor: actor("COO", { status: "DEACTIVATED" }),
      action: "stage.change",
      project: assignedProject("OPERATIONAL"),
      now: NOW,
    });

    expect(decision.allowed).toBe(false);
  });

  it("Akun yang masih berstatus Invited belum memiliki akses apa pun", () => {
    const decision = checkPermission({
      actor: actor("PROJECT_MANAGER", { status: "INVITED" }),
      action: "project.view",
      project: assignedProject("OPERATIONAL"),
      now: NOW,
    });

    expect(decision.allowed).toBe(false);
  });

  it("Jabatan tanpa tanggal berakhir tetap berlaku selama sudah melewati tanggal mulai", () => {
    const decision = checkPermission({
      actor: actor("CFO", {
        roleAssignments: [assignment("CFO", { endDate: null })],
      }),
      action: "finance.approve_final",
      project: foreignProject(),
      now: new Date("2030-01-01T00:00:00.000Z"),
    });

    expect(decision.allowed).toBe(true);
  });
});
