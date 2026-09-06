import { describe, expect, it } from "vitest";
import { canSeeAction, visibleMainNav } from "@/lib/auth/ui-visibility";
import { formatNpwpDisplay } from "@/lib/client/profile";
import { actor, NOW } from "../support/factories";

function labels(roleActor: ReturnType<typeof actor>) {
  return visibleMainNav(roleActor, NOW).map((item) => item.label);
}

describe("F06-T02 Halaman daftar client beserta formulir penambahannya.", () => {
  it("Menu Client tampil bagi yang boleh melihat master data, termasuk PM", () => {
    expect(labels(actor("PROJECT_MANAGER"))).toContain("Client");
    expect(labels(actor("COO"))).toContain("Client");
    expect(labels(actor("OFFICER_OPERATIONAL"))).toContain("Client");
  });

  it("Menu Client tersembunyi bagi TechDev Member yang tidak memakai master data", () => {
    expect(labels(actor("TECHDEV_MEMBER"))).not.toContain("Client");
  });

  it("Tombol tambah mengikuti client.manage di server, bukan hanya daftar", () => {
    expect(canSeeAction(actor("COO"), "client.manage", NOW)).toBe(true);
    expect(
      canSeeAction(actor("OFFICER_OPERATIONAL"), "client.manage", NOW),
    ).toBe(true);
    expect(canSeeAction(actor("PROJECT_MANAGER"), "client.manage", NOW)).toBe(
      false,
    );
    expect(
      canSeeAction(actor("PROJECT_MANAGER"), "master_data.view", NOW),
    ).toBe(true);
  });

  it("NPWP 15 digit ditampilkan dengan titik dan strip resmi", () => {
    expect(formatNpwpDisplay("012345678901000")).toBe("01.234.567.8-901.000");
    expect(formatNpwpDisplay(null)).toBe("—");
    expect(formatNpwpDisplay("1234567890123456")).toBe("1234567890123456");
  });
});
