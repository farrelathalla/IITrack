import type { Actor } from "@/lib/auth/types";
import type { TermAction } from "@/lib/finance/terms";
import {
  assignDevelopers,
  assignFinancePoc,
} from "@/server/project/assignments";
import { createProject } from "@/server/project/create";
import {
  completeStage1,
  decideSubmission,
  markSigned,
  saveDocument,
  submitDocument,
} from "@/server/project/documents";
import { submitStaffing } from "@/server/project/tech";
import { saveTerms, transitionTerm } from "@/server/project/terms";
import { createActor, testDb, testPeriod } from "./database";

export interface Team {
  periodId: string;
  periodCode: string;
  pm: Actor;
  otherPm: Actor;
  coo: Actor;
  vcoo: Actor;
  cto: Actor;
  dev: Actor;
  dev2: Actor;
  cfo: Actor;
  fin: Actor;
  admin: Actor;
}

/** Satu set pengurus aktif pada periode uji baru. */
export async function createTeam(): Promise<Team> {
  const period = await testPeriod();
  const make = (role: Parameters<typeof createActor>[0], name: string) =>
    createActor(role, period.id, name);
  return {
    periodId: period.id,
    periodCode: period.code,
    pm: await make("PROJECT_MANAGER", "PM Uji"),
    otherPm: await make("PROJECT_MANAGER", "PM Lain"),
    coo: await make("COO", "COO Uji"),
    vcoo: await make("VICE_COO", "Vice COO Uji"),
    cto: await make("CTO", "CTO Uji"),
    dev: await make("TECH_DEVELOPER", "Developer Uji"),
    dev2: await make("TECH_DEVELOPER", "Developer Dua"),
    cfo: await make("CFO", "CFO Uji"),
    fin: await make("FINANCE_POC", "Finance POC Uji"),
    admin: await make("SUPER_ADMIN", "Admin Uji"),
  };
}

const link = (slug: string) => `https://docs.google.com/document/d/${slug}`;

export async function newProject(
  team: Team,
  name = "Project Uji",
): Promise<string> {
  const { code } = await createProject({
    actor: team.coo,
    input: {
      name,
      client: "PT Client Uji",
      pmUserId: team.pm.userId,
      targetStart: "2026-08-01",
      targetEnd: "2026-12-31",
    },
  });
  return code;
}

export async function decidePending(
  code: string,
  kind: "PROJECT_CHARTER" | "MOU" | "PROGRAMMER_CONTRACT",
  actor: Actor,
  decision: "APPROVE" | "REJECT",
  feedback?: string,
): Promise<void> {
  const submission = await testDb.submission.findFirstOrThrow({
    where: { project: { code }, kind, status: "PENDING" },
  });
  await decideSubmission({
    actor,
    projectId: code,
    submissionId: submission.id,
    decision,
    feedback,
  });
}

export async function termStep(
  code: string,
  sequence: number,
  actor: Actor,
  action: TermAction,
) {
  const term = await testDb.term.findFirstOrThrow({
    where: { project: { code }, sequence },
  });
  await transitionTerm({ actor, projectId: code, termId: term.id, action });
}

export async function payTerm(team: Team, code: string, sequence: number) {
  await termStep(code, sequence, team.pm, "REQUEST_INVOICE");
  await termStep(code, sequence, team.fin, "PROCESS");
  await termStep(code, sequence, team.fin, "APPROVE_INVOICE");
  await termStep(code, sequence, team.fin, "MARK_SENT");
  await termStep(code, sequence, team.pm, "ADD_PROOF");
  await termStep(code, sequence, team.fin, "APPROVE_PAYMENT");
  await termStep(code, sequence, team.fin, "ISSUE_RECEIPT");
  await termStep(code, sequence, team.fin, "COMPLETE");
}

/** Stage 1 sampai MoU diajukan (belum diputuskan). */
export async function throughMouSubmitted(team: Team, code: string) {
  const { pm } = team;
  await saveDocument({
    actor: pm,
    projectId: code,
    input: { kind: "REQUIREMENT_GATHERING", url: link("rgd") },
  });
  await completeStage1({ actor: pm, projectId: code });
  await saveDocument({
    actor: pm,
    projectId: code,
    input: { kind: "PROJECT_CHARTER", url: link("charter") },
  });
  await submitDocument({ actor: pm, projectId: code, kind: "PROJECT_CHARTER" });
  await decidePending(code, "PROJECT_CHARTER", team.coo, "APPROVE");
  await saveDocument({
    actor: pm,
    projectId: code,
    input: { kind: "MOU", url: link("mou") },
  });
  await saveTerms({
    actor: pm,
    projectId: code,
    terms: [
      {
        name: "Termin 1 — DP",
        percentage: 30,
        amount: 3_000_000,
        dueDate: "2026-09-01",
      },
      {
        name: "Termin 2",
        percentage: 40,
        amount: 4_000_000,
        dueDate: "2026-10-01",
      },
      {
        name: "Termin 3 — Final",
        percentage: 30,
        amount: 3_000_000,
        dueNote: "Setelah BAST",
      },
    ],
  });
  await submitDocument({ actor: pm, projectId: code, kind: "MOU" });
}

/** Sampai Stage 4 selesai dan Finance POC ditunjuk (Stage 5 terbuka). */
export async function throughStage4(team: Team, code: string) {
  const { pm } = team;
  await throughMouSubmitted(team, code);
  await decidePending(code, "MOU", team.coo, "APPROVE");
  await markSigned({ actor: pm, projectId: code, kind: "MOU" });
  await submitStaffing({
    actor: pm,
    projectId: code,
    input: {
      technicalNeeds: "Web",
      roleRequested: "Full-stack Developer",
      headcount: 1,
      neededBy: "2026-09-10",
    },
  });
  await assignDevelopers({
    actor: team.cto,
    projectId: code,
    developers: [{ userId: team.dev.userId, techRole: "Full-stack Developer" }],
  });
  await saveDocument({
    actor: pm,
    projectId: code,
    input: {
      kind: "PROGRAMMER_CONTRACT",
      developerId: team.dev.userId,
      url: link("kontrak"),
    },
  });
  await submitDocument({
    actor: pm,
    projectId: code,
    kind: "PROGRAMMER_CONTRACT",
    developerId: team.dev.userId,
  });
  await decidePending(code, "PROGRAMMER_CONTRACT", team.cto, "APPROVE");
  await markSigned({
    actor: pm,
    projectId: code,
    kind: "PROGRAMMER_CONTRACT",
    developerId: team.dev.userId,
  });
  await assignFinancePoc({
    actor: team.cfo,
    projectId: code,
    userId: team.fin.userId,
  });
}
