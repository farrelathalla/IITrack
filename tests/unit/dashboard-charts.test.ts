import { describe, expect, it } from "vitest";
import {
  type ChartProject,
  divisionBars,
  isNotStarted,
  sinceMonthStart,
  statusSlices,
  stockAt,
} from "@/lib/project/dashboard-charts";

const day = (value: string) => new Date(`${value}T00:00:00+07:00`);

function project(
  overrides: Partial<ChartProject> & Pick<ChartProject, "stageNumber">,
): ChartProject {
  return {
    closedAt: null,
    createdAt: day("2026-08-01"),
    stageStatus: "in-progress",
    ...overrides,
  };
}

describe("PRD 4, grafik dashboard dari data tersimpan", () => {
  it("project baru masuk Belum dimulai dan batang Project Management", () => {
    const fresh = project({ stageNumber: 1, stageStatus: "not-started" });
    expect(isNotStarted(fresh)).toBe(true);
    expect(statusSlices([fresh]).map((slice) => slice.value)).toEqual([
      0, 0, 1,
    ]);
    expect(divisionBars([fresh])).toEqual([
      { label: "Tech Development", active: 0, completed: 0 },
      { label: "Finance", active: 0, completed: 0 },
      { label: "Project Management", active: 1, completed: 0 },
    ]);
  });

  it("project berjalan di stage 6 masuk Tech Development", () => {
    const running = project({ stageNumber: 6, stageStatus: "in-progress" });
    expect(divisionBars([running])[0]).toEqual({
      label: "Tech Development",
      active: 1,
      completed: 0,
    });
    expect(statusSlices([running])[0].value).toBe(1);
  });

  it("project yang sudah ditutup dihitung selesai pada stage 9", () => {
    const closed = project({
      stageNumber: 9,
      stageStatus: "completed",
      closedAt: day("2026-09-20"),
    });
    const bars = divisionBars([closed]);
    expect(bars[2]).toEqual({
      label: "Project Management",
      active: 0,
      completed: 1,
    });
    expect(statusSlices([closed])[1].value).toBe(1);
  });

  it("stok awal bulan memakai waktu buat dan waktu tutup", () => {
    const rows = [
      project({ stageNumber: 1, createdAt: day("2026-08-02") }),
      project({
        stageNumber: 9,
        createdAt: day("2026-08-02"),
        closedAt: day("2026-09-10"),
        stageStatus: "completed",
      }),
    ];
    const month = day("2026-09-01");
    expect(stockAt(rows, month, "all")).toBe(2);
    expect(stockAt(rows, month, "active")).toBe(2);
    expect(stockAt(rows, month, "completed")).toBe(0);
    expect(sinceMonthStart(1, 2)).toBe("−1 dari awal bulan");
    expect(sinceMonthStart(2, 2)).toBe("sama dengan awal bulan");
  });
});
