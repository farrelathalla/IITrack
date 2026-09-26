import { describe, expect, it } from "vitest";
import {
  currentStage,
  defaultPanelStage,
  deriveStages,
  newlyCompletedStages,
  type StageStatus,
} from "@/lib/project/stages";
import {
  DEV_ID,
  DEV2_ID,
  day,
  doc,
  emptyProject,
  member,
  NOW,
  PM_ID,
  projectThroughStage4,
  submission,
  term,
} from "../support/factories";

function statuses(project = emptyProject()): StageStatus[] {
  return deriveStages(project, NOW).map((s) => s.status);
}

describe("PRD 4.1 — sembilan stage berjalan berurutan", () => {
  it("project baru: Stage 1 belum dimulai, sisanya terkunci dengan alasan", () => {
    const stages = deriveStages(emptyProject(), NOW);
    expect(stages.map((s) => s.status)).toEqual([
      "not-started",
      ...Array(8).fill("locked"),
    ]);
    expect(stages[1].lockedReason).toBe(
      "Selesaikan Initial Communication & Requirement Gathering (Stage 1) terlebih dahulu.",
    );
  });

  it("Stage 1 berjalan saat dokumen ditautkan, selesai saat PM menandai selesai", () => {
    const linked = emptyProject({
      documents: [doc("REQUIREMENT_GATHERING", { status: "IN_PROGRESS" })],
    });
    expect(statuses(linked)[0]).toBe("in-progress");

    const done = { ...linked, stage1DoneAt: day("2026-08-05") };
    expect(statuses(done).slice(0, 2)).toEqual(["completed", "not-started"]);
  });

  it("Stage 2 mengikuti pengajuan Project Charter: menunggu, revisi, lalu selesai", () => {
    const charter = doc("PROJECT_CHARTER");
    const base = emptyProject({
      stage1DoneAt: day("2026-08-05"),
      documents: [doc("REQUIREMENT_GATHERING"), charter],
    });

    expect(
      statuses({
        ...base,
        submissions: [submission("PROJECT_CHARTER", charter, "PENDING")],
      })[1],
    ).toBe("waiting-approval");

    const rejected = deriveStages(
      {
        ...base,
        submissions: [submission("PROJECT_CHARTER", charter, "REJECTED")],
      },
      NOW,
    )[1];
    expect(rejected.status).toBe("revision-required");
    expect(rejected.rejection).toEqual({
      feedback: "Scope belum sesuai.",
      reviewerName: "Ghazy",
      decidedAt: day("2026-09-02"),
    });

    // Pengajuan ulang setelah ditolak: yang berlaku pengajuan terakhir.
    const resubmitted = {
      ...base,
      submissions: [
        submission("PROJECT_CHARTER", charter, "REJECTED"),
        submission("PROJECT_CHARTER", charter, "PENDING", {
          submittedAt: day("2026-09-03"),
        }),
      ],
    };
    expect(statuses(resubmitted)[1]).toBe("waiting-approval");

    const approved = {
      ...base,
      submissions: [submission("PROJECT_CHARTER", charter, "APPROVED")],
    };
    expect(statuses(approved).slice(1, 3)).toEqual([
      "completed",
      "not-started",
    ]);
  });

  it("Stage 3 berstatus Disetujui sampai MoU ditandatangani", () => {
    const charter = doc("PROJECT_CHARTER");
    const mou = doc("MOU");
    const project = emptyProject({
      stage1DoneAt: day("2026-08-05"),
      documents: [doc("REQUIREMENT_GATHERING"), charter, mou],
      submissions: [
        submission("PROJECT_CHARTER", charter, "APPROVED"),
        submission("MOU", mou, "APPROVED"),
      ],
    });
    expect(statuses(project)[2]).toBe("approved");

    const signed = {
      ...project,
      documents: [
        doc("REQUIREMENT_GATHERING"),
        charter,
        { ...mou, signedAt: day("2026-09-05") },
      ],
    };
    expect(statuses(signed).slice(2, 4)).toEqual(["completed", "not-started"]);
  });

  it("Stage 4 selesai bila developer ditugaskan dan semua kontraknya disetujui serta ditandatangani", () => {
    const project = projectThroughStage4();
    expect(statuses(project)[3]).toBe("completed");

    // Developer kedua tanpa kontrak membuat Stage 4 belum selesai.
    const twoDevs = {
      ...project,
      assignments: [...project.assignments, member("DEVELOPER", DEV2_ID)],
    };
    expect(statuses(twoDevs)[3]).toBe("in-progress");
  });

  it("Request SDM yang menunggu CTO/VCTO membuat Stage 4 Menunggu Persetujuan", () => {
    const base = projectThroughStage4();
    const waiting = {
      ...base,
      assignments: base.assignments.filter((a) => a.role !== "DEVELOPER"),
      documents: base.documents.filter((d) => d.kind !== "PROGRAMMER_CONTRACT"),
      staffing: base.staffing && {
        ...base.staffing,
        status: "WAITING_TECHDEV" as const,
      },
    };
    const stage4 = deriveStages(waiting, NOW)[3];
    expect(stage4.status).toBe("waiting-approval");
    expect(stage4.waitingFor).toBe("CTO / Vice CTO");
  });

  it("Stage 5 terkunci sampai CFO/VCFO menunjuk Finance POC", () => {
    const project = projectThroughStage4({
      assignments: [member("PM", PM_ID), member("DEVELOPER", DEV_ID)],
    });
    const stage5 = deriveStages(project, NOW)[4];
    expect(stage5.status).toBe("locked");
    expect(stage5.lockedReason).toBe("Menunggu CFO/VCFO menunjuk Finance POC.");
  });

  it("Stage 5 mengikuti alur termin DP, dan selesai saat DP Selesai", () => {
    const base = projectThroughStage4();
    const withDp = (step: Parameters<typeof term>[1], extra = {}) => ({
      ...base,
      terms: [term(1, step, extra), ...base.terms.slice(1)],
    });
    expect(statuses(withDp("NOT_STARTED"))[4]).toBe("not-started");
    expect(statuses(withDp("INVOICE_REQUESTED"))[4]).toBe("waiting-approval");
    expect(statuses(withDp("SENT_TO_CLIENT"))[4]).toBe("in-progress");
    expect(
      statuses(withDp("NOT_STARTED", { feedback: "Nominal salah" }))[4],
    ).toBe("revision-required");
    expect(statuses(withDp("DONE")).slice(4, 6)).toEqual([
      "completed",
      "not-started",
    ]);
  });

  it("Stage 6 selesai saat PM menandai pengembangan selesai", () => {
    const base = projectThroughStage4();
    const project = {
      ...base,
      terms: [term(1, "DONE"), ...base.terms.slice(1)],
      developmentDoneAt: day("2026-10-20"),
    };
    expect(statuses(project).slice(5, 7)).toEqual(["completed", "not-started"]);
  });

  it("Stage 7 butuh BAST ditandatangani, termin final Selesai, dan garansi Selesai", () => {
    const base = projectThroughStage4();
    const project = {
      ...base,
      developmentDoneAt: day("2026-10-20"),
      terms: [term(1, "DONE"), term(2, "DONE"), term(3, "DONE")],
      documents: [
        ...base.documents,
        doc("BAST", { signedAt: day("2026-10-25") }),
      ],
      handover: {
        uatStatus: "PASSED" as const,
        warrantyStart: day("2026-10-25"),
        warrantyEnd: day("2026-11-25"),
      },
    };
    // Garansi masih aktif pada 20 Nov.
    expect(deriveStages(project, day("2026-11-20"))[6].status).toBe(
      "in-progress",
    );
    // Sehari setelah akhir garansi, Stage 7 selesai dan Stage 8 terbuka.
    expect(
      deriveStages(project, day("2026-11-26"))
        .slice(6, 8)
        .map((s) => s.status),
    ).toEqual(["completed", "not-started"]);
  });

  it("stage yang sudah tercatat selesai tidak terkunci ulang oleh perubahan belakangan", () => {
    const base = projectThroughStage4();
    const replaced = {
      ...base,
      assignments: [
        member("PM", PM_ID),
        member("DEVELOPER", DEV2_ID),
        member("FINANCE_POC", "fin"),
      ],
      stageCompletedAt: {
        1: day("2026-08-05"),
        2: day("2026-08-10"),
        3: day("2026-09-05"),
        4: day("2026-09-08"),
      },
    };
    const result = deriveStages(replaced, NOW);
    expect(result[3].status).toBe("completed");
    expect(result[4].status).toBe("not-started");
  });

  it("stage yang baru memenuhi syarat dilaporkan untuk dicatat permanen", () => {
    const project = projectThroughStage4();
    const fresh = newlyCompletedStages(project, deriveStages(project, NOW));
    expect(fresh.map((s) => s.n)).toEqual([1, 2, 3, 4]);
  });

  it("panel default adalah stage yang sedang berjalan", () => {
    const project = projectThroughStage4();
    const stages = deriveStages(project, NOW);
    expect(currentStage(stages).n).toBe(5);
    expect(defaultPanelStage(stages)).toBe(5);
  });
});
