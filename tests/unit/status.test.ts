import { describe, expect, it } from "vitest";
import {
  closureChecklist,
  disbursementReadiness,
  finalStatusFor,
  isReadyToClose,
} from "@/lib/project/closure";
import { deriveStages } from "@/lib/project/stages";
import {
  isAwaitingUser,
  nextAction,
  openDeadlines,
  projectStatus,
  summarize,
  urgencyLabel,
} from "@/lib/project/status";
import {
  DEV_ID,
  day,
  doc,
  emptyProject,
  FIN_ID,
  member,
  NOW,
  PM_ID,
  projectThroughStage4,
  submission,
  term,
} from "../support/factories";

describe("PRD 9 — status project", () => {
  it("On Track bila tidak ada kondisi lain", () => {
    const project = emptyProject();
    const s = summarize(project, deriveStages(project, NOW), NOW);
    expect(s.status).toBe("ON_TRACK");
  });

  it("Action Required bila ada pengajuan yang ditolak", () => {
    const charter = doc("PROJECT_CHARTER");
    const project = emptyProject({
      stage1DoneAt: day("2026-08-05"),
      documents: [doc("REQUIREMENT_GATHERING"), charter],
      submissions: [submission("PROJECT_CHARTER", charter, "REJECTED")],
    });
    expect(summarize(project, deriveStages(project, NOW), NOW).status).toBe(
      "ACTION_REQUIRED",
    );
  });

  it("Action Required bila ada deadline yang lewat, mengalahkan Waiting Approval", () => {
    const charter = doc("PROJECT_CHARTER", { deadline: day("2026-09-20") });
    const project = emptyProject({
      stage1DoneAt: day("2026-08-05"),
      documents: [doc("REQUIREMENT_GATHERING"), charter],
      submissions: [submission("PROJECT_CHARTER", charter, "PENDING")],
    });
    expect(summarize(project, deriveStages(project, NOW), NOW).status).toBe(
      "ACTION_REQUIRED",
    );
  });

  it("Waiting Approval bila ada pengajuan menunggu approver", () => {
    const charter = doc("PROJECT_CHARTER");
    const project = emptyProject({
      stage1DoneAt: day("2026-08-05"),
      documents: [doc("REQUIREMENT_GATHERING"), charter],
      submissions: [submission("PROJECT_CHARTER", charter, "PENDING")],
    });
    expect(summarize(project, deriveStages(project, NOW), NOW).status).toBe(
      "WAITING_APPROVAL",
    );
  });

  it("At Risk bila deadline terdekat kurang dari 3 hari", () => {
    const project = emptyProject({
      documents: [
        doc("REQUIREMENT_GATHERING", {
          url: null,
          status: "IN_PROGRESS",
          deadline: day("2026-09-24"),
        }),
      ],
    });
    const stages = deriveStages(project, NOW);
    expect(projectStatus(stages, openDeadlines(project, stages), NOW)).toBe(
      "AT_RISK",
    );
  });

  it("project yang sudah ditutup tidak punya status berjalan", () => {
    const project = emptyProject({ closedAt: day("2026-09-01") });
    expect(
      summarize(project, deriveStages(project, NOW), NOW).status,
    ).toBeNull();
  });
});

describe("PRD 8.1 — deadline terdekat dan next action", () => {
  it("deadline diurutkan dari yang paling dekat dan hanya dari stage yang terbuka", () => {
    const project = emptyProject({
      documents: [
        doc("REQUIREMENT_GATHERING", {
          url: null,
          status: "MISSING",
          deadline: day("2026-09-30"),
        }),
      ],
      stageDeadlines: { 1: day("2026-09-25"), 2: day("2026-09-23") },
    });
    const deadlines = openDeadlines(project, deriveStages(project, NOW));
    expect(deadlines.map((d) => d.label)).toEqual([
      "Initial Comm. (Stage 1)",
      "Upload Requirement Gathering Document",
    ]);
  });

  it("chip urgensi: Overdue, Hari ini, Besok, n hari", () => {
    expect(urgencyLabel(day("2026-09-21"), NOW)).toBe("Overdue");
    expect(urgencyLabel(day("2026-09-22"), NOW)).toBe("Hari ini");
    expect(urgencyLabel(day("2026-09-23"), NOW)).toBe("Besok");
    expect(urgencyLabel(day("2026-09-30"), NOW)).toBe("8 hari");
  });

  it("MoU disetujui tetapi belum ditandatangani: PM mengunggah MoU bertanda tangan", () => {
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
    const action = nextAction(project, deriveStages(project, NOW), NOW);
    expect(action?.label).toBe("Upload MoU yang telah ditandatangani");
    expect(action?.responsible.userId).toBe(PM_ID);
  });

  it("pengajuan yang menunggu diarahkan ke jabatan approver", () => {
    const charter = doc("PROJECT_CHARTER");
    const project = emptyProject({
      stage1DoneAt: day("2026-08-05"),
      documents: [doc("REQUIREMENT_GATHERING"), charter],
      submissions: [submission("PROJECT_CHARTER", charter, "PENDING")],
    });
    const action = nextAction(project, deriveStages(project, NOW), NOW);
    expect(action?.responsible.name).toBe("COO / Vice COO");
    expect(isAwaitingUser(action, "siapa", "VICE_COO")).toBe(true);
    expect(isAwaitingUser(action, PM_ID, "PROJECT_MANAGER")).toBe(false);
  });

  it("tanpa Finance POC, CFO/VCFO diminta menunjuk Finance POC", () => {
    const project = projectThroughStage4({
      assignments: [member("PM", PM_ID), member("DEVELOPER", DEV_ID)],
    });
    const action = nextAction(project, deriveStages(project, NOW), NOW);
    expect(action?.label).toBe("Tunjuk Finance POC");
  });

  it("invoice DP yang diminta menunggu Finance POC", () => {
    const base = projectThroughStage4();
    const project = {
      ...base,
      terms: [term(1, "INVOICE_REQUESTED"), ...base.terms.slice(1)],
    };
    const action = nextAction(project, deriveStages(project, NOW), NOW);
    expect(action?.label).toBe("Proses invoice DP");
    expect(action?.responsible.userId).toBe(FIN_ID);
  });

  it("penugasan yang orangnya sudah nonaktif ditandai Perlu Penugasan Ulang", () => {
    const project = emptyProject({
      assignments: [member("PM", PM_ID, { userActive: false })],
    });
    const s = summarize(project, deriveStages(project, NOW), NOW);
    expect(s.needsReassignment.map((a) => a.userId)).toEqual([PM_ID]);
  });
});

describe("PRD 4.12 dan 5.5 — penutupan project", () => {
  function closable() {
    const base = projectThroughStage4();
    return {
      ...base,
      terms: base.terms.map((t) => ({ ...t, step: "DONE" as const })),
      handover: {
        uatStatus: "PASSED" as const,
        warrantyStart: day("2026-08-01"),
        warrantyEnd: day("2026-09-01"),
      },
      documents: [
        ...base.documents,
        doc("CLIENT_FEEDBACK"),
        doc("PROGRAMMER_FEEDBACK"),
        doc("PROJECT_DOCUMENTATION"),
        doc("SOURCE_CODE_DOCUMENTATION"),
      ],
    };
  }

  it("Finance Disbursement baru bisa diajukan setelah termin lunas, garansi selesai, dan feedback lengkap", () => {
    expect(disbursementReadiness(closable(), NOW)).toEqual({ ready: true });
    const missing = disbursementReadiness(projectThroughStage4(), NOW);
    expect(missing).toEqual({
      ready: false,
      missing: [
        "Semua Termin Pembayaran Lunas",
        "Garansi Selesai",
        "Client Feedback",
        "Programmer Feedback",
      ],
    });
  });

  it("project hanya bisa ditutup bila semua item checklist terpenuhi", () => {
    const project = closable();
    expect(isReadyToClose(project, NOW)).toBe(false);
    expect(
      closureChecklist(project, NOW).find((i) => i.key === "disbursement")
        ?.done,
    ).toBe(false);

    const disbursed = {
      ...project,
      disbursement: {
        status: "DISBURSED" as const,
        feedback: null,
        submittedAt: NOW,
        verifiedAt: NOW,
        decidedAt: NOW,
        decidedByName: "Dinda",
        disbursedAt: NOW,
      },
    };
    expect(isReadyToClose(disbursed, NOW)).toBe(true);
  });

  it("Status Final dari tanggal penutupan dibanding target dengan toleransi", () => {
    const target = day("2026-11-30");
    expect(finalStatusFor(day("2026-11-10"), target, 7)).toBe("EARLY");
    expect(finalStatusFor(day("2026-11-25"), target, 7)).toBe("ON_TIME");
    expect(finalStatusFor(day("2026-12-07"), target, 7)).toBe("ON_TIME");
    expect(finalStatusFor(day("2026-12-08"), target, 7)).toBe("LATE");
  });
});
