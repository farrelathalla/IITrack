/**
 * Data contoh untuk pengembangan, mengikuti tokoh dan project di prototipe
 * Figma Make IITRACK.
 *
 * Project dibangun lewat fungsi server yang sama dengan aplikasi (buat
 * project, ajukan, setujui, alur termin, dan seterusnya), bukan ditulis
 * langsung ke tabel. Dengan begitu data contoh selalu konsisten dengan aturan
 * bisnis, dan riwayat aktivitasnya terisi seperti pemakaian sungguhan.
 *
 * Semua akun memakai kata sandi `iitrack-dev-2627`. Jangan pakai di lingkungan
 * yang dipakai orang sungguhan.
 */

import { hashPassword } from "@/lib/auth/password";
import type { Actor, RoleName } from "@/lib/auth/types";
import type { TermAction } from "@/lib/finance/terms";
import { ACTOR_SELECT, toActor } from "@/server/auth/actor";
import { prisma } from "@/server/db";
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
import {
  addMilestone,
  closeProject,
  decideDisbursement,
  markDevelopmentDone,
  markDisbursed,
  setUatStatus,
  setWarranty,
  submitDisbursement,
  updateLatestUpdate,
  verifyDisbursement,
} from "@/server/project/operations";
import { submitStaffing, updateTechInfo } from "@/server/project/tech";
import { saveTerms, transitionTerm } from "@/server/project/terms";

const PASSWORD = "iitrack-dev-2627";

const PEOPLE: { key: string; name: string; email: string; role: RoleName }[] = [
  {
    key: "karen",
    name: "Karen Evangeline",
    email: "karen@iit.test",
    role: "PROJECT_MANAGER",
  },
  {
    key: "rizky",
    name: "Rizky Pratama",
    email: "rizky@iit.test",
    role: "PROJECT_MANAGER",
  },
  {
    key: "ghazy",
    name: "Ghazy Nur Fauzan",
    email: "ghazy@iit.test",
    role: "COO",
  },
  {
    key: "keisha",
    name: "Keisha Daffa Aryani",
    email: "keisha@iit.test",
    role: "VICE_COO",
  },
  {
    key: "adnan",
    name: "Adnan Kurniawan",
    email: "adnan@iit.test",
    role: "CTO",
  },
  {
    key: "budi",
    name: "Budi Santoso",
    email: "budi@iit.test",
    role: "VICE_CTO",
  },
  {
    key: "anice",
    name: "Anice Pratiwi",
    email: "anice@iit.test",
    role: "TECH_DEVELOPER",
  },
  {
    key: "rafi",
    name: "Rafi Hidayat",
    email: "rafi@iit.test",
    role: "TECH_DEVELOPER",
  },
  {
    key: "dinda",
    name: "Dinda Maharani",
    email: "dinda@iit.test",
    role: "CFO",
  },
  {
    key: "rima",
    name: "Rima Oktavia",
    email: "rima@iit.test",
    role: "VICE_CFO",
  },
  {
    key: "evan",
    name: "Evan Mahendra",
    email: "evan@iit.test",
    role: "FINANCE_POC",
  },
  {
    key: "admin",
    name: "Admin System",
    email: "admin@iit.test",
    role: "SUPER_ADMIN",
  },
];

function wib(iso: string): Date {
  return new Date(`${iso}T00:00:00+07:00`);
}

async function main() {
  if ((await prisma.user.count()) > 0) {
    console.log(
      "Basis data sudah berisi pengguna; seed dilewati. Jalankan `bun run db:reset` untuk mengulang dari kosong.",
    );
    return;
  }

  const period = await prisma.period.create({
    data: {
      name: "2026/2027",
      code: "2627",
      startDate: wib("2026-08-01"),
      endDate: wib("2027-08-01"),
    },
  });
  await prisma.period.create({
    data: {
      name: "2025/2026",
      code: "2526",
      startDate: wib("2025-08-01"),
      endDate: wib("2026-08-01"),
    },
  });

  const passwordHash = await hashPassword(PASSWORD);
  const actors: Record<string, Actor> = {};
  for (const person of PEOPLE) {
    const user = await prisma.user.create({
      data: {
        name: person.name,
        email: person.email,
        passwordHash,
        roleAssignments: { create: { role: person.role, periodId: period.id } },
      },
      select: ACTOR_SELECT,
    });
    actors[person.key] = toActor(user);
  }
  const id = (key: string) => actors[key].userId;
  const { karen, rizky, ghazy, keisha, adnan, anice, rafi, dinda, evan } =
    actors;

  const link = (slug: string) => `https://docs.google.com/document/d/${slug}`;

  // Helper alur umum.
  async function throughMou(
    code: string,
    pm: Actor,
    terms: Parameters<typeof saveTerms>[0]["terms"],
  ) {
    await saveDocument({
      actor: pm,
      projectId: code,
      input: {
        kind: "REQUIREMENT_GATHERING",
        url: link(`${code}-rgd`),
        status: "DONE",
      },
    });
    await completeStage1({ actor: pm, projectId: code });
    await saveDocument({
      actor: pm,
      projectId: code,
      input: { kind: "PROJECT_CHARTER", url: link(`${code}-charter`) },
    });
    await saveDocument({
      actor: pm,
      projectId: code,
      input: { kind: "GANTT_CHART", url: link(`${code}-gantt`) },
    });
    await submitDocument({
      actor: pm,
      projectId: code,
      kind: "PROJECT_CHARTER",
    });
    await decide(code, "PROJECT_CHARTER", ghazy, "APPROVE");
    await decide(code, "PROJECT_CHARTER", adnan, "APPROVE");
    await saveDocument({
      actor: pm,
      projectId: code,
      input: { kind: "MOU", url: link(`${code}-mou`) },
    });
    await saveTerms({ actor: pm, projectId: code, terms });
  }

  async function decide(
    code: string,
    kind: "PROJECT_CHARTER" | "MOU" | "PROGRAMMER_CONTRACT",
    actor: Actor,
    decision: "APPROVE" | "REJECT",
    feedback?: string,
  ) {
    const submission = await prisma.submission.findFirstOrThrow({
      where: { project: { code }, kind, status: "PENDING" },
      orderBy: { submittedAt: "desc" },
    });
    await decideSubmission({
      actor,
      projectId: code,
      submissionId: submission.id,
      decision,
      feedback,
    });
  }

  async function step(
    code: string,
    sequence: number,
    actor: Actor,
    action: TermAction,
    url?: string,
  ) {
    const term = await prisma.term.findFirstOrThrow({
      where: { project: { code }, sequence },
    });
    await transitionTerm({
      actor,
      projectId: code,
      termId: term.id,
      action,
      url,
    });
  }

  async function payTerm(code: string, sequence: number, pm: Actor) {
    await step(code, sequence, pm, "REQUEST_INVOICE");
    await step(code, sequence, evan, "PROCESS");
    await step(
      code,
      sequence,
      evan,
      "APPROVE_INVOICE",
      link(`${code}-inv-${sequence}`),
    );
    await step(code, sequence, evan, "MARK_SENT");
    await step(
      code,
      sequence,
      pm,
      "ADD_PROOF",
      `https://drive.google.com/file/d/${code}-tf-${sequence}`,
    );
    await step(code, sequence, evan, "APPROVE_PAYMENT");
    await step(
      code,
      sequence,
      evan,
      "ISSUE_RECEIPT",
      link(`${code}-kw-${sequence}`),
    );
    await step(code, sequence, evan, "COMPLETE");
  }

  async function throughStage5(
    code: string,
    pm: Actor,
    developers: { userId: string; techRole: string }[],
  ) {
    await submitDocument({ actor: pm, projectId: code, kind: "MOU" });
    await decide(code, "MOU", ghazy, "APPROVE");
    await saveDocument({
      actor: pm,
      projectId: code,
      input: { kind: "MOU", url: link(`${code}-mou-signed`) },
    });
    await markSigned({ actor: pm, projectId: code, kind: "MOU" });
    await submitStaffing({
      actor: pm,
      projectId: code,
      input: {
        technicalNeeds: "Aplikasi web internal dengan integrasi API.",
        roleRequested: "Full-stack Developer",
        headcount: developers.length,
        neededBy: "2026-08-25",
      },
    });
    await assignDevelopers({ actor: adnan, projectId: code, developers });
    for (const developer of developers) {
      await saveDocument({
        actor: pm,
        projectId: code,
        input: {
          kind: "PROGRAMMER_CONTRACT",
          developerId: developer.userId,
          url: link(`${code}-kontrak-${developer.userId}`),
        },
      });
      await submitDocument({
        actor: pm,
        projectId: code,
        kind: "PROGRAMMER_CONTRACT",
        developerId: developer.userId,
      });
      await decide(code, "PROGRAMMER_CONTRACT", adnan, "APPROVE");
      await markSigned({
        actor: pm,
        projectId: code,
        kind: "PROGRAMMER_CONTRACT",
        developerId: developer.userId,
      });
    }
    await assignFinancePoc({
      actor: dinda,
      projectId: code,
      userId: id("evan"),
    });
    await payTerm(code, 1, pm);
  }

  const threeTerms = (dp: string, t2: string) => [
    { name: "Termin 1 (DP)", percentage: 30, amount: 4_500_000, dueDate: dp },
    { name: "Termin 2", percentage: 40, amount: 6_000_000, dueDate: t2 },
    {
      name: "Termin 3 (Final)",
      percentage: 30,
      amount: 4_500_000,
      dueNote: "Setelah BAST",
    },
  ];

  // 1. Project yang sudah selesai seluruhnya.
  const medibase = await createProject({
    actor: ghazy,
    input: {
      name: "Medibase Clinic System",
      client: "Klinik Medibase",
      type: "DEVELOPMENT",
      source: "BUSINESS_DEVELOPMENT",
      pmUserId: id("karen"),
      targetStart: "2026-08-01",
      targetEnd: "2026-09-20",
    },
  });
  await throughMou(medibase.code, karen, [
    {
      name: "Termin 1 (DP)",
      percentage: 50,
      amount: 10_000_000,
      dueDate: "2026-08-10",
    },
    {
      name: "Termin 2 (Final)",
      percentage: 50,
      amount: 10_000_000,
      dueNote: "Setelah BAST",
    },
  ]);
  await throughStage5(medibase.code, karen, [
    { userId: id("rafi"), techRole: "Full-stack Developer" },
  ]);
  await updateTechInfo({
    actor: rafi,
    projectId: medibase.code,
    input: {
      githubRepo: "https://github.com/inkubatorit/medibase",
      sprintPlanning: "https://github.com/orgs/inkubatorit/projects/3",
      currentSprint: "Sprint 3",
      progressPercent: "100",
      nextMilestone: "Handover",
    },
  });
  await markDevelopmentDone({ actor: karen, projectId: medibase.code });
  await saveDocument({
    actor: karen,
    projectId: medibase.code,
    input: { kind: "TESTING_RESULT", url: link("medibase-testing") },
  });
  await setUatStatus({
    actor: karen,
    projectId: medibase.code,
    status: "PASSED",
  });
  await saveDocument({
    actor: karen,
    projectId: medibase.code,
    input: { kind: "BAST", url: link("medibase-bast") },
  });
  await markSigned({ actor: karen, projectId: medibase.code, kind: "BAST" });
  await setWarranty({
    actor: karen,
    projectId: medibase.code,
    input: { warrantyStart: "2026-08-20", warrantyEnd: "2026-09-10" },
  });
  await payTerm(medibase.code, 2, karen);
  await saveDocument({
    actor: karen,
    projectId: medibase.code,
    input: { kind: "CLIENT_FEEDBACK", url: link("medibase-client-fb") },
  });
  await saveDocument({
    actor: karen,
    projectId: medibase.code,
    input: { kind: "PROGRAMMER_FEEDBACK", url: link("medibase-prog-fb") },
  });
  await saveDocument({
    actor: karen,
    projectId: medibase.code,
    input: { kind: "PROJECT_DOCUMENTATION", url: link("medibase-docs") },
  });
  await saveDocument({
    actor: karen,
    projectId: medibase.code,
    input: {
      kind: "SOURCE_CODE_DOCUMENTATION",
      url: "https://github.com/inkubatorit/medibase/wiki",
    },
  });
  await submitDisbursement({ actor: karen, projectId: medibase.code });
  await verifyDisbursement({ actor: evan, projectId: medibase.code });
  await decideDisbursement({
    actor: dinda,
    projectId: medibase.code,
    decision: "APPROVE",
  });
  await markDisbursed({ actor: evan, projectId: medibase.code });
  await closeProject({ actor: karen, projectId: medibase.code });

  // 2. DataSync: Stage 6, sedang pengembangan, termin 2 sedang diproses.
  const datasync = await createProject({
    actor: ghazy,
    input: {
      name: "DataSync ERP Integration",
      client: "CV DataSync Solutions",
      type: "INTEGRATION",
      source: "BUSINESS_DEVELOPMENT",
      pmUserId: id("karen"),
      targetStart: "2026-08-03",
      targetEnd: "2026-12-15",
    },
  });
  await throughMou(
    datasync.code,
    karen,
    threeTerms("2026-09-01", "2026-10-15"),
  );
  await throughStage5(datasync.code, karen, [
    { userId: id("anice"), techRole: "Full-stack Developer" },
    { userId: id("rafi"), techRole: "Backend Developer" },
  ]);
  await updateTechInfo({
    actor: anice,
    projectId: datasync.code,
    input: {
      githubRepo: "https://github.com/inkubatorit/datasync-erp",
      sprintPlanning: "https://www.notion.so/inkubatorit/datasync-sprint",
      currentSprint: "Sprint 4 (18-25 Sep)",
      progressPercent: "68",
      nextMilestone: "UAT, 30 Sep 2026",
    },
  });
  await updateLatestUpdate({
    actor: karen,
    projectId: datasync.code,
    text: "Modul sinkronisasi inventori selesai, lanjut modul laporan.",
  });
  await addMilestone({
    actor: karen,
    projectId: datasync.code,
    input: { name: "Sprint 4 Review", date: "2026-09-25" },
  });
  await addMilestone({
    actor: karen,
    projectId: datasync.code,
    input: { name: "UAT", date: "2026-09-30" },
  });
  await addMilestone({
    actor: karen,
    projectId: datasync.code,
    input: { name: "BAST & Handover", date: "2026-12-15" },
  });
  await step(datasync.code, 2, karen, "REQUEST_INVOICE");
  await step(datasync.code, 2, evan, "PROCESS");

  // 3. Pharmanova: MoU ditolak Vice COO, perlu revisi.
  const pharmanova = await createProject({
    actor: ghazy,
    input: {
      name: "Pharmanova Internal Platform",
      client: "PT Pharmanova Nusantara",
      type: "DEVELOPMENT",
      source: "BUSINESS_DEVELOPMENT",
      pmUserId: id("karen"),
      targetStart: "2026-08-10",
      targetEnd: "2026-11-30",
    },
  });
  await throughMou(
    pharmanova.code,
    karen,
    threeTerms("2026-10-05", "2026-11-01"),
  );
  await saveDocument({
    actor: karen,
    projectId: pharmanova.code,
    input: { kind: "MOU", deadline: "2026-09-30" },
  });
  await submitDocument({
    actor: karen,
    projectId: pharmanova.code,
    kind: "MOU",
  });
  await decide(
    pharmanova.code,
    "MOU",
    keisha,
    "REJECT",
    "Scope pada MoU belum sesuai Project Charter. Perbaiki bagian deliverables dan pastikan nilai kontrak sesuai cost estimation terbaru.",
  );

  // 4. Logismart: Project Charter menunggu persetujuan COO dan CTO.
  const logismart = await createProject({
    actor: keisha,
    input: {
      name: "Logismart Dashboard",
      client: "PT Logismart Indonesia",
      type: "DEVELOPMENT",
      source: "NON_BD",
      pmUserId: id("rizky"),
      targetStart: "2026-09-01",
      targetEnd: "2027-02-28",
    },
  });
  await saveDocument({
    actor: rizky,
    projectId: logismart.code,
    input: {
      kind: "REQUIREMENT_GATHERING",
      url: link("logismart-rgd"),
      status: "DONE",
    },
  });
  await completeStage1({ actor: rizky, projectId: logismart.code });
  await saveDocument({
    actor: rizky,
    projectId: logismart.code,
    input: {
      kind: "PROJECT_CHARTER",
      url: link("logismart-charter"),
      deadline: "2026-10-02",
    },
  });
  await submitDocument({
    actor: rizky,
    projectId: logismart.code,
    kind: "PROJECT_CHARTER",
  });

  // 5. Project baru yang baru dibuat, Stage 1.
  await createProject({
    actor: ghazy,
    input: {
      name: "EduTrack Learning Portal",
      client: "Yayasan Didaktika",
      type: "DEVELOPMENT",
      source: "GOVERNMENT",
      pmUserId: id("rizky"),
      targetStart: "2026-10-01",
      targetEnd: "2027-03-31",
    },
  });

  console.log(
    `Seed selesai: ${PEOPLE.length} akun, 5 project. Kata sandi semua akun: ${PASSWORD}`,
  );
  for (const person of PEOPLE)
    console.log(`  ${person.email.padEnd(18)} ${person.role}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
