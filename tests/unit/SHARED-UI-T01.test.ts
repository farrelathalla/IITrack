import { describe, expect, it } from "vitest";
import { normalizeStatusKey, toneForStatus } from "@/lib/ui/status";

describe("SHARED-UI-T01 Pemetaan status ke nada visual.", () => {
  it("Menyeragamkan ejaan status sebelum dipetakan", () => {
    expect(normalizeStatusKey("In Progress")).toBe("in_progress");
    expect(normalizeStatusKey("  ditolak ")).toBe("ditolak");
  });

  it("Memetakan status bisnis umum ke nada yang sesuai", () => {
    expect(toneForStatus("menunggu")).toBe("pending");
    expect(toneForStatus("disetujui")).toBe("success");
    expect(toneForStatus("ditolak")).toBe("danger");
    expect(toneForStatus("berjalan")).toBe("running");
    expect(toneForStatus("ACTIVE")).toBe("running");
  });

  it("Status yang tidak dikenal jatuh ke neutral, bukan error", () => {
    expect(toneForStatus("status-aneh-xyz")).toBe("neutral");
  });
});
