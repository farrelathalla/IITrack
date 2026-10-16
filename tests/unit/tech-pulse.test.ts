import { describe, expect, it } from "vitest";
import { techPulse } from "@/lib/project/tech-pulse";
import { NOW, projectThroughStage4 } from "../support/factories";

describe("techPulse", () => {
  it("belum dimulai bila developer belum ada dan belum ada jejak", () => {
    const project = projectThroughStage4({
      assignments: projectThroughStage4().assignments.filter(
        (row) => row.role !== "DEVELOPER",
      ),
    });
    expect(techPulse(project, NOW).status).toBe("NOT_STARTED");
  });

  it("blocked bila ada blocker terbuka, tanpa isian status terpisah", () => {
    const project = projectThroughStage4({
      blockers: [
        {
          id: "b1",
          description: "API client tutup",
          resolvedAt: null,
          createdByName: "Anice",
          createdAt: NOW,
        },
      ],
    });
    const pulse = techPulse(project, NOW);
    expect(pulse.status).toBe("BLOCKED");
    expect(pulse.openBlockers).toBe(1);
  });

  it("stale bila jejak terakhir lebih dari tujuh hari", () => {
    const eightDaysAgo = new Date(NOW.getTime() - 8 * 24 * 60 * 60 * 1000);
    const project = projectThroughStage4({
      techInfo: {
        githubRepo: "https://github.com/iit/demo",
        sprintPlanning: null,
        currentSprint: "Sprint 1",
        progressPercent: 20,
        nextMilestone: null,
        latestUpdate: null,
        latestUpdateAt: null,
        updatedAt: eightDaysAgo,
      },
    });
    expect(techPulse(project, NOW).status).toBe("STALE");
  });

  it("on track bila ada jejak dalam tujuh hari", () => {
    const project = projectThroughStage4({
      techInfo: {
        githubRepo: "https://github.com/iit/demo",
        sprintPlanning: null,
        currentSprint: "Sprint 1",
        progressPercent: 20,
        nextMilestone: null,
        latestUpdate: null,
        latestUpdateAt: null,
        updatedAt: NOW,
      },
    });
    expect(techPulse(project, NOW).status).toBe("ON_TRACK");
  });
});
