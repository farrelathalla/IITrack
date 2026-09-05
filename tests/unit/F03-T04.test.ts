import { describe, expect, it } from "vitest";
import { canSeeAction, visibleMainNav } from "@/lib/auth/ui-visibility";
import { actor, assignment, NOW } from "../support/factories";

function labels(roleActor: ReturnType<typeof actor>) {
  return visibleMainNav(roleActor, NOW).map((item) => item.label);
}

describe("F03-T04 Menyembunyikan menu dan tombol di luar kewenangan.", () => {
  it("Beranda selalu tampil untuk jabatan aktif", () => {
    expect(labels(actor("FINANCE_POC"))).toContain("Beranda");
    expect(labels(actor("TECHDEV_MEMBER"))).toContain("Beranda");
  });

  it("Daftarkan project hanya untuk jabatan yang punya project.create", () => {
    expect(labels(actor("PROJECT_MANAGER"))).toContain("Daftarkan project");
    expect(labels(actor("COO"))).toContain("Daftarkan project");
    expect(labels(actor("CFO"))).not.toContain("Daftarkan project");
    expect(labels(actor("FINANCE_POC"))).not.toContain("Daftarkan project");
    expect(labels(actor("TECHDEV_MEMBER"))).not.toContain("Daftarkan project");
  });

  it("Pengurus tampil untuk pemilik master_data.view, tersembunyi untuk TechDev Member biasa", () => {
    expect(labels(actor("CFO"))).toContain("Pengurus");
    expect(labels(actor("OFFICER_OPERATIONAL"))).toContain("Pengurus");
    expect(labels(actor("TECHDEV_MEMBER"))).not.toContain("Pengurus");
  });

  it("System Admin tanpa master_data.view tetap melihat menu Pengurus lewat member.manage", () => {
    const admin = actor("TECHDEV_MEMBER", {
      roleAssignments: [assignment("TECHDEV_MEMBER", { isSystemAdmin: true })],
    });

    expect(labels(admin)).toContain("Pengurus");
    expect(canSeeAction(admin, "user.manage_role_assignment", NOW)).toBe(true);
    expect(canSeeAction(admin, "project.create", NOW)).toBe(false);
  });

  it("canSeeAction mengikuti checkPermission untuk tombol di halaman", () => {
    expect(canSeeAction(actor("PROJECT_MANAGER"), "project.create", NOW)).toBe(
      true,
    );
    expect(canSeeAction(actor("CFO"), "project.create", NOW)).toBe(false);
    expect(
      canSeeAction(actor("COO"), ["member.manage", "client.manage"], NOW),
    ).toBe(true);
  });
});
