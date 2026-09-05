import { describe, expect, it } from "vitest";
import {
  buildPmAssignmentSlaView,
  formatWorkingDuration,
} from "@/lib/sla/display";
import { DEFAULT_WORKING_HOURS } from "@/lib/sla/working-hours";

function wib(iso: string): Date {
  return new Date(`${iso}+07:00`);
}

describe("F04-T02 Tampilan selisih penugasan terhadap ambang SLA.", () => {
  it("Memformat durasi jam kerja ke teks Indonesia", () => {
    expect(formatWorkingDuration(0)).toBe("0 menit kerja");
    expect(formatWorkingDuration(45)).toBe("45 menit kerja");
    expect(formatWorkingDuration(120)).toBe("2 jam kerja");
    expect(formatWorkingDuration(150)).toBe("2 jam 30 menit kerja");
  });

  it("Menandai penugasan dalam ambang sebagai Dalam SLA", () => {
    const view = buildPmAssignmentSlaView({
      clientConfirmedAt: wib("2026-09-01T09:00:00"),
      pmAssignedAt: wib("2026-09-01T12:00:00"),
      workingHours: DEFAULT_WORKING_HOURS,
    });

    expect(view).not.toBeNull();
    expect(view?.badgeLabel).toBe("Dalam SLA");
    expect(view?.tone).toBe("success");
    expect(view?.elapsedLabel).toBe("3 jam kerja");
    expect(view?.evaluation.withinThreshold).toBe(true);
  });

  it("Menandai penugasan lewat ambang sebagai Terlambat", () => {
    // 09.00 sampai 16.00 = 7 jam kerja > ambang 6 jam.
    const view = buildPmAssignmentSlaView({
      clientConfirmedAt: wib("2026-09-01T09:00:00"),
      pmAssignedAt: wib("2026-09-01T16:00:00"),
      workingHours: DEFAULT_WORKING_HOURS,
    });

    expect(view).not.toBeNull();
    expect(view?.badgeLabel).toBe("Terlambat");
    expect(view?.tone).toBe("danger");
    expect(view?.evaluation.overdueMinutes).toBe(60);
    expect(view?.summary).toContain("lewat");
  });

  it("Mengembalikan null bila stempel belum lengkap", () => {
    expect(
      buildPmAssignmentSlaView({
        clientConfirmedAt: wib("2026-09-01T09:00:00"),
        pmAssignedAt: null,
      }),
    ).toBeNull();
  });
});
