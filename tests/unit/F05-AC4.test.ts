import { describe, expect, it } from "vitest";
import { checkPermission } from "@/lib/auth/permissions";
import {
  actor,
  assignedProject,
  foreignProject,
  NOW,
} from "../support/factories";

describe("F05-AC4 PM tidak bisa melakukannya.", () => {
  it("PM boleh mendaftarkan project, karena dialah yang menerima Project ID-nya", () => {
    const decision = checkPermission({
      actor: actor("PROJECT_MANAGER"),
      action: "project.create",
      now: NOW,
    });

    expect(decision.allowed).toBe(true);
  });

  it("PM tidak boleh menetapkan Project ID secara manual, walaupun pada project yang ditugaskan kepadanya", () => {
    const decision = checkPermission({
      actor: actor("PROJECT_MANAGER"),
      action: "project.override_id",
      project: assignedProject("OPERATIONAL"),
      now: NOW,
    });

    expect(decision.allowed).toBe(false);
  });

  it("COO dan Vice COO boleh menetapkan Project ID secara manual", () => {
    for (const jabatan of ["COO", "VICE_COO"] as const) {
      expect(
        checkPermission({
          actor: actor(jabatan),
          action: "project.override_id",
          project: foreignProject(),
          now: NOW,
        }).allowed,
      ).toBe(true);
    }
  });

  it("Jabatan Finance dan TechDev juga tidak boleh menetapkan nomor project", () => {
    for (const jabatan of ["CFO", "CTO", "FINANCE_POC"] as const) {
      expect(
        checkPermission({
          actor: actor(jabatan),
          action: "project.override_id",
          project: foreignProject(),
          now: NOW,
        }).allowed,
      ).toBe(false);
    }
  });
});
