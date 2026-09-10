import { describe, expect, it } from "vitest";
import {
  canSeeAddReferenceForm,
  parseReferenceForm,
  REFERENCE_FORM_EXCLUSIONS,
  REFERENCE_FORM_FIELDS,
  REFERENCE_FORM_PLACEMENT,
  referenceKindLabel,
} from "@/lib/project/reference-form";
import { plannedNavNow } from "@/lib/ui/project-hub-layout";
import {
  actor,
  assignedProject,
  foreignProject,
  NOW,
} from "../support/factories";

describe("F25-T02 Formulir dan daftar tautan rujukan pada halaman project, termasuk repository GitHub.", () => {
  it("F25-AC1, tautan tersimpan bersama Project ID; isiannya alamat https dan nama, bukan berkas", () => {
    expect(REFERENCE_FORM_PLACEMENT).toEqual({
      surface: "hub",
      section: "documents",
    });
    expect(REFERENCE_FORM_FIELDS.map((field) => field.key)).toEqual([
      "url",
      "label",
    ]);
    expect(REFERENCE_FORM_FIELDS.every((field) => field.required)).toBe(true);
    expect([...REFERENCE_FORM_EXCLUSIONS]).toEqual([
      "fileUpload",
      "binaryStore",
      "copyOfFile",
    ]);
  });

  it("F25-AC2, jenis GitHub dibedakan supaya repository bisa dibuka dari hub", () => {
    expect(referenceKindLabel("GITHUB_REPO")).toBe("GitHub");
    expect(referenceKindLabel("GOOGLE_DRIVE")).toBe("Drive");
    expect(referenceKindLabel("NOTION")).toBe("Notion");
  });

  it("F25-AC3, tautan tinggal di hub, bukan salinan di Finance atau TechDev, dan tanpa item nav baru", () => {
    expect(REFERENCE_FORM_PLACEMENT.surface).toBe("hub");
    expect(plannedNavNow().map((item) => item.key)).toEqual([
      "beranda",
      "project",
      "client",
      "pengurus",
      "finance_queue",
    ]);
  });

  it("Tombol tambah untuk Operational atau TechDev yang boleh edit, bukan Finance POC", () => {
    expect(
      canSeeAddReferenceForm(
        actor("PROJECT_MANAGER"),
        assignedProject("OPERATIONAL"),
        NOW,
      ),
    ).toBe(true);
    expect(
      canSeeAddReferenceForm(actor("PROJECT_MANAGER"), foreignProject(), NOW),
    ).toBe(false);
    expect(
      canSeeAddReferenceForm(
        actor("FINANCE_POC"),
        assignedProject("FINANCE"),
        NOW,
      ),
    ).toBe(false);
    expect(canSeeAddReferenceForm(actor("CTO"), foreignProject(), NOW)).toBe(
      true,
    );
    expect(
      canSeeAddReferenceForm(
        actor("TECHDEV_MEMBER"),
        assignedProject("TECHDEV"),
        NOW,
      ),
    ).toBe(true);
  });

  it("Alamat http, GitHub yang bukan repo, dan nama kosong ditolak", () => {
    const kosong = parseReferenceForm({
      projectDbId: "  ",
      url: "http://drive.google.com/file/d/abc",
      label: "  ",
    });
    expect(kosong.ok).toBe(false);
    if (kosong.ok) return;
    expect(kosong.fields.projectDbId).toBeDefined();
    expect(kosong.fields.url).toBeDefined();
    expect(kosong.fields.label).toBeDefined();

    const bukanRepo = parseReferenceForm({
      projectDbId: "proj-1",
      url: "https://github.com/InkubatorIT",
      label: "Repo",
    });
    expect(bukanRepo.ok).toBe(false);

    const lengkap = parseReferenceForm({
      projectDbId: "proj-1",
      url: "https://drive.google.com/file/d/abc/",
      label: "  Bukti MoU  ",
    });
    expect(lengkap.ok).toBe(true);
    if (!lengkap.ok) return;
    expect(lengkap.data.url).toBe("https://drive.google.com/file/d/abc");
    expect(lengkap.data.label).toBe("Bukti MoU");
  });
});
