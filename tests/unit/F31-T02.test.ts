import { describe, expect, it } from "vitest";
import {
  ASSIGNMENT_FORM_FIELDS,
  ASSIGNMENT_FORM_PLACEMENT,
  assignableDivisionsFor,
  canSeeAssignMemberForm,
  canSeeEndAssignment,
  divisionLabel,
} from "@/lib/project/assignment-display";
import { parseAssignmentForm } from "@/lib/project/assignment-form";
import { plannedNavNow } from "@/lib/ui/project-hub-layout";
import { actor, NOW } from "../support/factories";

describe("F31-T02 Membuat pemilih anggota yang ditugaskan pada halaman project.", () => {
  it("F31-AC1, form di panel Tim hub memuat divisi dan pengurus, tanpa item nav baru", () => {
    expect(ASSIGNMENT_FORM_PLACEMENT).toEqual({
      surface: "hub",
      section: "team",
    });
    expect(ASSIGNMENT_FORM_FIELDS.map((field) => field.key)).toEqual([
      "division",
      "userId",
    ]);
    expect(ASSIGNMENT_FORM_FIELDS.every((field) => field.required)).toBe(true);
    expect(plannedNavNow().map((item) => item.key)).toEqual([
      "beranda",
      "project",
      "client",
      "pengurus",
      "finance_queue",
    ]);
  });

  it("F31-AC1, C-Level hanya melihat form untuk domainnya sendiri", () => {
    expect(canSeeAssignMemberForm(actor("COO"), NOW)).toBe(true);
    expect(assignableDivisionsFor(actor("COO"), NOW)).toEqual(["OPERATIONAL"]);
    expect(assignableDivisionsFor(actor("CFO"), NOW)).toEqual(["FINANCE"]);
    expect(assignableDivisionsFor(actor("CTO"), NOW)).toEqual(["TECHDEV"]);
    expect(canSeeAssignMemberForm(actor("PROJECT_MANAGER"), NOW)).toBe(false);
    expect(canSeeAssignMemberForm(actor("TECHDEV_MEMBER"), NOW)).toBe(false);
  });

  it("F31-AC1, tombol akhiri hanya untuk divisi yang dipimpin", () => {
    expect(canSeeEndAssignment(actor("COO"), "OPERATIONAL", NOW)).toBe(true);
    expect(canSeeEndAssignment(actor("COO"), "FINANCE", NOW)).toBe(false);
    expect(canSeeEndAssignment(actor("CFO"), "FINANCE", NOW)).toBe(true);
    expect(
      canSeeEndAssignment(actor("PROJECT_MANAGER"), "OPERATIONAL", NOW),
    ).toBe(false);
  });

  it("Label divisi terbaca untuk ketiga domain", () => {
    expect(divisionLabel("OPERATIONAL")).toBe("Operational");
    expect(divisionLabel("FINANCE")).toBe("Finance");
    expect(divisionLabel("TECHDEV")).toBe("TechDev");
  });

  it("Isian kosong ditolak sebelum sampai ke server", () => {
    const kosong = parseAssignmentForm({
      projectDbId: "proj-1",
      division: "",
      userId: "",
    });
    expect(kosong.ok).toBe(false);
    if (kosong.ok) return;
    expect(kosong.fields.division).toBeTruthy();
    expect(kosong.fields.userId).toBeTruthy();

    const ok = parseAssignmentForm({
      projectDbId: "proj-1",
      division: "TECHDEV",
      userId: "user-1",
    });
    expect(ok.ok).toBe(true);
  });
});
