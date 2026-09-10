import { describe, expect, it } from "vitest";
import { liveTerminFeedback } from "@/lib/termin/live";
import {
  TERMIN_FORM_PLACEMENT,
  TERMIN_LIVE_CHECKS,
} from "@/lib/ui/registration-termin-layout";

describe("F13-T02 Formulir jadwal termin memberi tahu jumlah persentase sebelum submit.", () => {
  it("Form tetap di panel hub, bukan rute baru", () => {
    expect(TERMIN_FORM_PLACEMENT.surface).toBe("hub");
    expect(TERMIN_FORM_PLACEMENT.section).toBe("termin");
  });

  it("UAT-TERM-002, jumlah 100 persen ditandai lengkap tanpa menunggu jatuh tempo", () => {
    const live = liveTerminFeedback({
      projectValue: "10000000",
      drafts: [{ percentage: "30" }, { percentage: "70" }],
    });
    expect(live.total.ok).toBe(true);
    expect(live.total.display).toBe("100.00 / 100");
    expect(live.dp.ok).toBe(true);
    expect(live.dp.display).toBe("30.00%");
  });

  it("Jumlah belum 100 dan DP di luar 25–50 ditandai sebelum submit", () => {
    const live = liveTerminFeedback({
      projectValue: "10000000",
      drafts: [{ percentage: "20" }, { percentage: "40" }],
    });
    expect(live.total.ok).toBe(false);
    expect(live.total.display).toBe("60.00 / 100");
    expect(live.dp.ok).toBe(false);
    expect(live.dp.display).toBe("20.00%");
  });

  it("Nominal saja dihitung jadi persentase dari nilai project", () => {
    const live = liveTerminFeedback({
      projectValue: "10000000",
      drafts: [{ amount: "3000000" }, { amount: "7000000" }],
    });
    expect(live.total.ok).toBe(true);
    expect(live.dp.ok).toBe(true);
    expect(live.dp.display).toBe("30.00%");
  });

  it("Kontrak umpan balik langsung tetap jumlah 100 dan DP 25–50", () => {
    expect(TERMIN_LIVE_CHECKS.map((check) => check.key)).toEqual([
      "total_percent",
      "dp_range",
    ]);
  });
});
