import { describe, expect, it } from "vitest";
import { checkPermission } from "@/lib/auth/permissions";
import type { Action } from "@/lib/auth/types";
import {
  actor,
  assignedProject,
  assignment,
  foreignProject,
  NOW,
} from "../support/factories";

describe("F03-AC2 Menyembunyikan tombol saja tidak cukup: permintaan langsung ke server tetap ditolak.", () => {
  it("Keputusan izin tidak bergantung pada tampilan, sehingga aksi yang tombolnya disembunyikan tetap ditolak saat dipanggil langsung", () => {
    const decision = checkPermission({
      actor: actor("OFFICER_OPERATIONAL"),
      action: "finance.approve_final",
      project: assignedProject("OPERATIONAL"),
      now: NOW,
    });

    expect(decision.allowed).toBe(false);
  });

  it("Aksi bercakupan project ditolak bila konteks project tidak disertakan, bukan diloloskan", () => {
    const decision = checkPermission({
      actor: actor("PROJECT_MANAGER"),
      action: "project.edit_operational",
      now: NOW,
    });

    expect(decision.allowed).toBe(false);
  });

  it("Jabatan tanpa hak atas sebuah aksi ditolak secara default, tanpa perlu larangan eksplisit", () => {
    const everyAction: Action[] = [
      "client.manage",
      "member.manage",
      "project.create",
      "project.override_id",
      "project.assign_pm",
      "project.assign_member",
      "stage.change",
      "gate.override",
      "finance.edit",
      "finance.approve_final",
      "staffing.approve",
      "approval.project_value_scope",
      "user.invite",
    ];

    const plainTechDevMember = actor("TECHDEV_MEMBER");

    for (const action of everyAction) {
      expect(
        checkPermission({
          actor: plainTechDevMember,
          action,
          project: assignedProject("TECHDEV"),
          now: NOW,
        }).allowed,
      ).toBe(false);
    }
  });

  it("Pelaksana TechDev yang ditugaskan boleh mengubah data TechDev project itu, tetapi hanya itu", () => {
    const pelaksana = actor("TECHDEV_MEMBER");

    // PRD bab 3.2: pelaksana TechDev mengubah staffing, penugasan developer,
    // dan informasi repository. Domain lain tetap lihat saja.
    expect(
      checkPermission({
        actor: pelaksana,
        action: "techdev.edit",
        project: assignedProject("TECHDEV"),
        now: NOW,
      }).allowed,
    ).toBe(true);

    expect(
      checkPermission({
        actor: pelaksana,
        action: "techdev.edit",
        project: foreignProject(),
        now: NOW,
      }).allowed,
    ).toBe(false);
  });

  it("Entri audit log tidak bisa dihapus oleh jabatan mana pun, termasuk pemegang System Administrator privilege", () => {
    const authorizedTechDev = actor("TECHDEV_MEMBER", {
      roleAssignments: [assignment("TECHDEV_MEMBER", { isSystemAdmin: true })],
    });

    for (const subject of [
      actor("COO"),
      actor("CFO"),
      actor("CTO"),
      authorizedTechDev,
    ]) {
      expect(
        checkPermission({
          actor: subject,
          action: "audit.delete",
          project: foreignProject(),
          now: NOW,
        }).allowed,
      ).toBe(false);
    }
  });
});
