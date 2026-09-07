import { describe, expect, it } from "vitest";
import { canSeeAction, visibleMainNav } from "@/lib/auth/ui-visibility";
import {
  canSeeStaffingQueue,
  canSeeStaffingRequestForm,
  STAFFING_FORM_PLACEMENT,
  STAFFING_QUEUE_HREF,
  STAFFING_REQUEST_FIELDS,
  staffingStatusLabel,
} from "@/lib/staffing/display";
import { parseHeadcount, parseStaffingRequestForm } from "@/lib/staffing/form";
import { plannedNavNow } from "@/lib/ui/project-hub-layout";
import {
  actor,
  assignedProject,
  foreignProject,
  NOW,
} from "../support/factories";

describe("F14-T03 Formulir permintaan programmer dan halaman penugasan CTO.", () => {
  it("F14-AC1, isian form memuat jabatan, jumlah, tanggal, kebutuhan teknis, dan deliverable", () => {
    expect(STAFFING_REQUEST_FIELDS.map((field) => field.key)).toEqual([
      "roleNeeded",
      "headcount",
      "neededBy",
      "technicalNeeds",
      "deliverable",
    ]);
    expect(STAFFING_REQUEST_FIELDS.every((field) => field.required)).toBe(true);
  });

  it("Form tetap di panel Tim hub, bukan item nav baru", () => {
    expect(STAFFING_FORM_PLACEMENT.surface).toBe("hub");
    expect(STAFFING_FORM_PLACEMENT.section).toBe("team");
    expect(plannedNavNow().map((item) => item.key)).toEqual([
      "beranda",
      "project",
      "client",
      "pengurus",
      "finance_queue",
    ]);
    expect(
      plannedNavNow().some((item) => item.href === STAFFING_QUEUE_HREF),
    ).toBe(false);
    expect(STAFFING_QUEUE_HREF).toBe("/techdev/antrean");
  });

  it("UAT-SDM-001, tombol ajukan hanya untuk PM yang ditugaskan", () => {
    expect(
      canSeeStaffingRequestForm(
        actor("PROJECT_MANAGER"),
        assignedProject("OPERATIONAL"),
        NOW,
      ),
    ).toBe(true);
    expect(
      canSeeStaffingRequestForm(
        actor("PROJECT_MANAGER"),
        foreignProject(),
        NOW,
      ),
    ).toBe(false);
    expect(
      canSeeStaffingRequestForm(
        actor("COO"),
        assignedProject("OPERATIONAL"),
        NOW,
      ),
    ).toBe(false);
  });

  it("UAT-SDM-002, antrean hanya untuk CTO atau Vice CTO, bukan semua yang techdev.view", () => {
    expect(canSeeStaffingQueue(actor("CTO"), NOW)).toBe(true);
    expect(canSeeStaffingQueue(actor("VICE_CTO"), NOW)).toBe(true);
    expect(canSeeStaffingQueue(actor("PROJECT_MANAGER"), NOW)).toBe(false);
    expect(canSeeStaffingQueue(actor("COO"), NOW)).toBe(false);
    expect(canSeeAction(actor("PROJECT_MANAGER"), "techdev.view", NOW)).toBe(
      true,
    );
  });

  it("UAT-SDM-003, status Ditetapkan dibedakan dari Diajukan", () => {
    expect(staffingStatusLabel("SUBMITTED")).toBe("Diajukan");
    expect(staffingStatusLabel("FULFILLED")).toBe("Ditetapkan");
  });

  it("Isian jumlah dan tanggal yang kosong ditolak sebelum sampai server", () => {
    expect(parseHeadcount("2").ok).toBe(true);
    expect(parseHeadcount("0").ok).toBe(false);
    expect(parseHeadcount("satu").ok).toBe(false);

    const kosong = parseStaffingRequestForm({
      roleNeeded: "  ",
      headcount: "",
      neededBy: "",
      technicalNeeds: "   ",
      deliverable: "",
    });
    expect(kosong.ok).toBe(false);
    if (kosong.ok) return;
    expect(kosong.fields.roleNeeded).toBeDefined();
    expect(kosong.fields.headcount).toBeDefined();
    expect(kosong.fields.neededBy).toBeDefined();
    expect(kosong.fields.technicalNeeds).toBeDefined();
    expect(kosong.fields.deliverable).toBeDefined();
  });

  it("Tanggal dari input date dibaca sebagai tengah malam WIB", () => {
    const isi = parseStaffingRequestForm({
      roleNeeded: "Backend Developer",
      headcount: "2",
      neededBy: "2026-09-15",
      technicalNeeds: "Next.js",
      deliverable: "API siap diuji",
    });
    expect(isi.ok).toBe(true);
    if (!isi.ok) return;
    expect(isi.data.headcount).toBe(2);
    expect(isi.data.neededBy.toISOString()).toBe("2026-09-14T17:00:00.000Z");
  });

  it("Menu utama pengunjung tidak bertambah item staffing", () => {
    const nav = visibleMainNav(actor("CTO"), NOW);
    expect(nav.map((item) => item.label)).toEqual([
      "Beranda",
      "Project",
      "Client",
      "Pengurus",
      "Antrean Finance",
    ]);
    expect(nav.some((item) => item.href === STAFFING_QUEUE_HREF)).toBe(false);
  });
});
