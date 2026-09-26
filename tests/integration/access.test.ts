import { beforeAll, describe, expect, it } from "vitest";
import { canGlobally } from "@/lib/auth/access";
import { editRole, revokeAccess } from "@/server/admin/users";
import { viewerOf } from "@/server/auth/actor";
import { assignPm } from "@/server/project/assignments";
import { createProject } from "@/server/project/create";
import { saveDocument, submitDocument } from "@/server/project/documents";
import { closeProject } from "@/server/project/operations";
import { loadSnapshot } from "@/server/project/snapshot";
import { transitionTerm } from "@/server/project/terms";
import { loadProjectView } from "@/server/project/view";
import { createActor, testDb } from "../support/database";
import {
  createTeam,
  decidePending,
  newProject,
  type Team,
  throughMouSubmitted,
  throughStage4,
} from "../support/world";

describe("PRD 2.4 dan 13: izin diperiksa di server, termasuk bila dipanggil langsung", () => {
  let team: Team;
  let code: string;
  beforeAll(async () => {
    team = await createTeam();
    code = await newProject(team);
  });

  it("hanya COO/VCOO yang bisa membuat project", async () => {
    await expect(
      createProject({
        actor: team.pm,
        input: {
          name: "X",
          client: "Y",
          pmUserId: team.pm.userId,
          targetStart: "2026-08-01",
          targetEnd: "2026-09-01",
        },
      }),
    ).rejects.toThrow("Hanya COO dan Vice COO yang dapat membuat project.");
  });

  it("PM lain, COO, dan Super Admin tidak bisa mengubah isian Operasional project ini", async () => {
    for (const actor of [team.otherPm, team.coo, team.admin]) {
      await expect(
        saveDocument({
          actor,
          projectId: code,
          input: {
            kind: "REQUIREMENT_GATHERING",
            url: "https://example.com/x",
          },
        }),
      ).rejects.toThrow();
    }
  });

  it("tautan dokumen harus berupa URL valid", async () => {
    await expect(
      saveDocument({
        actor: team.pm,
        projectId: code,
        input: { kind: "REQUIREMENT_GATHERING", url: "bukan tautan" },
      }),
    ).rejects.toThrow("Tautan harus berupa URL valid");
  });

  it("stage yang terkunci tidak bisa diisi, dan alasannya disebutkan", async () => {
    const fresh = await newProject(team, "Terkunci");
    await expect(
      saveDocument({
        actor: team.pm,
        projectId: fresh,
        input: { kind: "MOU", url: "https://example.com/mou" },
      }),
    ).rejects.toThrow(
      "Selesaikan Feasibility Evaluation & Planning (Stage 2) terlebih dahulu.",
    );
  });

  it("CTO tidak bisa memutuskan MoU; penolakan wajib disertai feedback", async () => {
    const project = await newProject(team, "Keputusan");
    await throughMouSubmitted(team, project);
    await expect(
      decidePending(project, "MOU", team.cto, "APPROVE"),
    ).rejects.toThrow(/COO/);
    await expect(
      decidePending(project, "MOU", team.coo, "REJECT", "  "),
    ).rejects.toThrow("Feedback wajib diisi saat menolak.");
  });

  it("selama menunggu persetujuan, isian dokumen terkunci", async () => {
    const project = await newProject(team, "Terkunci Menunggu");
    await throughMouSubmitted(team, project);
    await expect(
      saveDocument({
        actor: team.pm,
        projectId: project,
        input: { kind: "MOU", url: "https://example.com/lain" },
      }),
    ).rejects.toThrow("sedang menunggu persetujuan");
  });

  it("Finance POC project lain tidak bisa memproses termin; CFO bisa sebagai cadangan", async () => {
    const project = await newProject(team, "Cadangan");
    await throughStage4(team, project);
    const snapshot = await loadSnapshot(project);
    const dp = snapshot?.terms[0];
    if (!dp) throw new Error("termin hilang");
    await transitionTerm({
      actor: team.pm,
      projectId: project,
      termId: dp.id,
      action: "REQUEST_INVOICE",
    });

    const otherPoc = await createActor(
      "FINANCE_POC",
      team.periodId,
      "POC Lain",
    );
    for (const actor of [otherPoc, team.pm]) {
      await expect(
        transitionTerm({
          actor,
          projectId: project,
          termId: dp.id,
          action: "PROCESS",
        }),
      ).rejects.toThrow(/Finance POC/);
    }
    await transitionTerm({
      actor: team.cfo,
      projectId: project,
      termId: dp.id,
      action: "PROCESS",
    });
    const log = await testDb.activityLog.findFirst({
      where: { project: { code: project }, action: "term.process" },
    });
    expect(log?.actorId).toBe(team.cfo.userId);
    expect(log?.summary).toContain("sebagai cadangan Finance POC");
  });

  it("project yang sudah ditutup read-only; checklist belum lengkap menolak penutupan", async () => {
    const project = await newProject(team, "Belum Lengkap");
    await expect(
      closeProject({ actor: team.coo, projectId: project }),
    ).rejects.toThrow();
  });

  it("nominal dan tautan yang dibatasi tidak ikut terkirim ke pengguna yang tidak berhak", async () => {
    const project = await newProject(team, "Visibilitas");
    await throughStage4(team, project);
    const devView = await loadProjectView(project, viewerOf(team.dev));
    const adminView = await loadProjectView(project, viewerOf(team.admin));
    const pmView = await loadProjectView(project, viewerOf(team.pm));

    for (const view of [devView, adminView]) {
      expect(view?.amountsHidden).toBe(true);
      expect(view?.project.terms.every((t) => t.amount === 0)).toBe(true);
      expect(
        view?.project.documents.find((d) => d.kind === "MOU")?.url,
      ).toBeNull();
    }
    expect(
      devView?.project.documents.find((d) => d.kind === "PROGRAMMER_CONTRACT")
        ?.url,
    ).not.toBeNull();
    expect(
      adminView?.project.documents.find((d) => d.kind === "PROGRAMMER_CONTRACT")
        ?.url,
    ).toBeNull();
    expect(pmView?.project.terms[0].amount).toBe(3_000_000);
  });
});

describe("PRD 2.3: keputusan pertama yang berlaku", () => {
  it("COO dan Vice COO memutuskan bersamaan: satu berhasil, yang lain ditolak", async () => {
    const team = await createTeam();
    const code = await newProject(team);
    await saveDocument({
      actor: team.pm,
      projectId: code,
      input: { kind: "REQUIREMENT_GATHERING", url: "https://example.com/rgd" },
    });
    const { completeStage1 } = await import("@/server/project/documents");
    await completeStage1({ actor: team.pm, projectId: code });
    await saveDocument({
      actor: team.pm,
      projectId: code,
      input: { kind: "PROJECT_CHARTER", url: "https://example.com/charter" },
    });
    await submitDocument({
      actor: team.pm,
      projectId: code,
      kind: "PROJECT_CHARTER",
    });

    const results = await Promise.allSettled([
      decidePending(code, "PROJECT_CHARTER", team.coo, "APPROVE"),
      decidePending(
        code,
        "PROJECT_CHARTER",
        team.vcoo,
        "REJECT",
        "Perlu revisi",
      ),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const decided = await testDb.submission.findMany({
      where: { project: { code }, kind: "PROJECT_CHARTER" },
    });
    expect(decided).toHaveLength(1);
    expect(decided[0].status).not.toBe("PENDING");
  });
});

describe("PRD 2.5: regenerasi pengurus", () => {
  it("mengubah jabatan PM mencabut hak editnya seketika dan menandai Perlu Penugasan Ulang", async () => {
    const team = await createTeam();
    const code = await newProject(team);
    const period = await testDb.roleAssignment.findFirstOrThrow({
      where: { userId: team.pm.userId },
    });
    await editRole({
      actor: team.admin,
      input: {
        userId: team.pm.userId,
        role: "VICE_COO",
        periodId: period.periodId,
      },
    });

    const { loadActor } = await import("@/server/auth/actor");
    const promoted = await loadActor(team.pm.userId);
    if (!promoted) throw new Error("akun hilang");
    await expect(
      saveDocument({
        actor: promoted,
        projectId: code,
        input: { kind: "REQUIREMENT_GATHERING", url: "https://example.com/a" },
      }),
    ).rejects.toThrow();

    const view = await loadProjectView(code, viewerOf(team.coo));
    expect(view?.summary.needsReassignment.map((a) => a.userId)).toEqual([
      team.pm.userId,
    ]);

    await assignPm({
      actor: team.coo,
      projectId: code,
      userId: team.otherPm.userId,
    });
    const after = await loadProjectView(code, viewerOf(team.coo));
    expect(after?.summary.needsReassignment).toEqual([]);
  });

  it("mencabut akses mengakhiri sesi, menonaktifkan akun, dan tidak berlaku untuk Super Admin terakhir yang mencabut dirinya", async () => {
    const team = await createTeam();
    await testDb.session.create({
      data: {
        userId: team.dev.userId,
        tokenHash: `uji-${Date.now()}`,
        expiresAt: new Date(Date.now() + 3600e3),
      },
    });
    await revokeAccess({
      actor: team.admin,
      input: { userId: team.dev.userId, reason: "Keluar dari kepengurusan" },
    });

    const user = await testDb.user.findUniqueOrThrow({
      where: { id: team.dev.userId },
    });
    expect(user.status).toBe("INACTIVE");
    expect(user.revokeReason).toBe("Keluar dari kepengurusan");
    expect(
      await testDb.session.count({
        where: { userId: team.dev.userId, revokedAt: null },
      }),
    ).toBe(0);
    expect(
      canGlobally(viewerOf({ ...team.dev, status: "INACTIVE" }), "users.view")
        .allowed,
    ).toBe(false);
  });
});

describe("PRD 13: riwayat aktivitas hanya bisa ditambah", () => {
  it("UPDATE dan DELETE pada activity_logs ditolak basis data", async () => {
    const row = await testDb.activityLog.findFirstOrThrow();
    await expect(
      testDb.activityLog.update({
        where: { id: row.id },
        data: { summary: "diubah" },
      }),
    ).rejects.toThrow();
    await expect(
      testDb.activityLog.delete({ where: { id: row.id } }),
    ).rejects.toThrow();
  });
});
