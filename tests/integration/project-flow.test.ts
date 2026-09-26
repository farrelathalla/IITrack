import { beforeAll, describe, expect, it } from "vitest";
import { deriveStages } from "@/lib/project/stages";
import { markSigned, saveDocument } from "@/server/project/documents";
import {
  closeProject,
  decideDisbursement,
  markDevelopmentDone,
  markDisbursed,
  setWarranty,
  submitDisbursement,
  verifyDisbursement,
} from "@/server/project/operations";
import { loadSnapshot } from "@/server/project/snapshot";
import { testDb } from "../support/database";
import {
  createTeam,
  newProject,
  payTerm,
  type Team,
  throughStage4,
} from "../support/world";

async function statuses(code: string) {
  const project = await loadSnapshot(code);
  if (!project) throw new Error("project hilang");
  return deriveStages(project, new Date()).map((s) => s.status);
}

describe("PRD 4: alur project end-to-end, dari pembuatan sampai Project Selesai", () => {
  let team: Team;
  beforeAll(async () => {
    team = await createTeam();
  });

  it("menerbitkan Project ID berformat IIT-[periode]-[3 digit] dan menugaskan PM", async () => {
    const code = await newProject(team);
    expect(code).toMatch(new RegExp(`^IIT-${team.periodCode}-\\d{3}$`));
    const project = await loadSnapshot(code);
    expect(project?.assignments.map((a) => [a.role, a.userId])).toEqual([
      ["PM", team.pm.userId],
    ]);
    const notification = await testDb.notification.findFirst({
      where: { userId: team.pm.userId },
    });
    expect(notification?.message).toBe(`Anda ditugaskan ke Project ${code}.`);
  });

  it("melewati sembilan stage berurutan sampai project ditutup dengan Status Final", async () => {
    const code = await newProject(team, "Alur Penuh");
    await throughStage4(team, code);
    expect((await statuses(code)).slice(0, 5)).toEqual([
      "completed",
      "completed",
      "completed",
      "completed",
      "not-started",
    ]);

    await payTerm(team, code, 1);
    expect((await statuses(code))[4]).toBe("completed");

    await payTerm(team, code, 2);
    await markDevelopmentDone({ actor: team.pm, projectId: code });
    await saveDocument({
      actor: team.pm,
      projectId: code,
      input: { kind: "BAST", url: "https://docs.google.com/document/d/bast" },
    });
    await markSigned({ actor: team.pm, projectId: code, kind: "BAST" });
    await setWarranty({
      actor: team.pm,
      projectId: code,
      input: { warrantyStart: "2026-01-01", warrantyEnd: "2026-02-01" },
    });
    await payTerm(team, code, 3);
    expect((await statuses(code)).slice(6, 8)).toEqual([
      "completed",
      "not-started",
    ]);

    for (const kind of [
      "CLIENT_FEEDBACK",
      "PROGRAMMER_FEEDBACK",
      "PROJECT_DOCUMENTATION",
      "SOURCE_CODE_DOCUMENTATION",
    ] as const) {
      await saveDocument({
        actor: team.pm,
        projectId: code,
        input: { kind, url: `https://docs.google.com/document/d/${kind}` },
      });
    }
    await expect(
      closeProject({ actor: team.pm, projectId: code }),
    ).rejects.toThrow(/Belum semua syarat terpenuhi/);

    await submitDisbursement({ actor: team.pm, projectId: code });
    await verifyDisbursement({ actor: team.fin, projectId: code });
    await decideDisbursement({
      actor: team.cfo,
      projectId: code,
      decision: "APPROVE",
    });
    await markDisbursed({ actor: team.fin, projectId: code });
    await closeProject({ actor: team.pm, projectId: code });

    const closed = await loadSnapshot(code);
    expect(closed?.closedAt).not.toBeNull();
    expect(closed?.finalStatus).not.toBeNull();
    expect(await statuses(code)).toEqual(Array(9).fill("completed"));
  });

  it("mencatat setiap pengajuan, keputusan, perubahan termin, dan penutupan di Riwayat Aktivitas", async () => {
    const code = await newProject(team, "Riwayat");
    await throughStage4(team, code);
    const actions = (
      await testDb.activityLog.findMany({
        where: { project: { code } },
        select: { action: true },
      })
    ).map((a) => a.action);
    for (const expected of [
      "project.created",
      "stage1.completed",
      "submission.submitted",
      "submission.approved",
      "terms.saved",
      "document.signed",
      "staffing.submitted",
      "assignment.developer",
      "assignment.finance_poc",
      "stage.completed",
    ]) {
      expect(actions).toContain(expected);
    }
  });
});
