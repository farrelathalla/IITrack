/**
 * Katalog sembilan stage tetap dan jenis dokumen (PRD bab 4.1 dan 4.3).
 */

import type { Division } from "@/lib/auth/types";

export type StageNumber = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export const STAGE_NUMBERS: readonly StageNumber[] = [
  1, 2, 3, 4, 5, 6, 7, 8, 9,
];
export const TOTAL_STAGES = 9;

export interface StageDefinition {
  n: StageNumber;
  name: string;
  /** Label singkat di stepper. */
  shortName: string;
  /** Teks divisi di header panel stage. */
  divisionLabel: string;
  /** Divisi yang menjadi penanggung jawab utama stage. */
  division: Division;
  description: string;
}

export const STAGES: readonly StageDefinition[] = [
  {
    n: 1,
    name: "Initial Communication & Requirement Gathering",
    shortName: "Initial Comm.",
    divisionLabel: "Project Management",
    division: "OPERATIONAL",
    description:
      "Komunikasi awal dengan client dan pengumpulan kebutuhan: scope, timeline, budget, konteks teknis, dan deliverable.",
  },
  {
    n: 2,
    name: "Feasibility Evaluation & Planning",
    shortName: "Feasibility",
    divisionLabel: "Project Management",
    division: "OPERATIONAL",
    description:
      "Menilai kelayakan project dan menetapkan scope, biaya, timeline, serta rencana project. Project Charter perlu disetujui COO/VCOO.",
  },
  {
    n: 3,
    name: "Agreement",
    shortName: "Agreement",
    divisionLabel: "Project Management",
    division: "OPERATIONAL",
    description:
      "Menyelesaikan perjanjian formal dengan client. MoU dibuat di Google Docs, disetujui COO/VCOO, lalu ditandatangani client.",
  },
  {
    n: 4,
    name: "Programmer / Tech Assignment",
    shortName: "Tech Assignment",
    divisionLabel: "Tech Development",
    division: "TECHDEV",
    description:
      "Mendapatkan developer lewat Request SDM, lalu menyelesaikan Kontrak Programmer untuk setiap developer.",
  },
  {
    n: 5,
    name: "Down Payment",
    shortName: "Down Payment",
    divisionLabel: "Finance",
    division: "FINANCE",
    description:
      "Menyelesaikan pembayaran pertama sebelum pengembangan dimulai. Status invoice, pembayaran, dan kwitansi diperbarui Finance POC.",
  },
  {
    n: 6,
    name: "Project Execution & Monitoring",
    shortName: "Execution",
    divisionLabel: "Tech Development",
    division: "TECHDEV",
    description:
      "Memantau pengembangan, progres developer, milestone, dan pembayaran termin lanjutan.",
  },
  {
    n: 7,
    name: "Handover & Warranty",
    shortName: "Handover",
    divisionLabel: "Project Management + Tech",
    division: "OPERATIONAL",
    description:
      "Testing, serah terima ke client (BAST), pelunasan termin final, dan pemantauan masa garansi.",
  },
  {
    n: 8,
    name: "Evaluation",
    shortName: "Evaluation",
    divisionLabel: "Project Management",
    division: "OPERATIONAL",
    description: "Mengumpulkan evaluasi dari client dan programmer.",
  },
  {
    n: 9,
    name: "Documentation & Closure",
    shortName: "Closure",
    divisionLabel: "Project Management + Finance",
    division: "OPERATIONAL",
    description:
      "Melengkapi dokumentasi dan administrasi penutupan. Semua syarat harus terpenuhi sebelum project ditandai selesai.",
  },
];

export function stageDefinition(n: number): StageDefinition {
  const found = STAGES.find((stage) => stage.n === n);
  if (!found) throw new Error(`Stage ${n} tidak dikenal.`);
  return found;
}

export function isStageNumber(value: number): value is StageNumber {
  return Number.isInteger(value) && value >= 1 && value <= TOTAL_STAGES;
}

export type DocumentKind =
  | "REQUIREMENT_GATHERING"
  | "PROJECT_CHARTER"
  | "GANTT_CHART"
  | "MOU"
  | "PROGRAMMER_CONTRACT"
  | "PROGRESS_REPORT"
  | "TESTING_RESULT"
  | "BAST"
  | "CLIENT_FEEDBACK"
  | "PROGRAMMER_FEEDBACK"
  | "PROJECT_DOCUMENTATION"
  | "SOURCE_CODE_DOCUMENTATION";

export type DocumentStatus = "MISSING" | "IN_PROGRESS" | "SUBMITTED" | "DONE";

export interface DocumentDefinition {
  kind: DocumentKind;
  name: string;
  stage: StageNumber;
  required: boolean;
}

export const DOCUMENTS: Record<DocumentKind, DocumentDefinition> = {
  REQUIREMENT_GATHERING: {
    kind: "REQUIREMENT_GATHERING",
    name: "Requirement Gathering Document",
    stage: 1,
    required: true,
  },
  PROJECT_CHARTER: {
    kind: "PROJECT_CHARTER",
    name: "Project Charter",
    stage: 2,
    required: true,
  },
  GANTT_CHART: {
    kind: "GANTT_CHART",
    name: "Gantt Chart / Project Timeline",
    stage: 2,
    required: false,
  },
  MOU: {
    kind: "MOU",
    name: "Client Agreement / MoU",
    stage: 3,
    required: true,
  },
  PROGRAMMER_CONTRACT: {
    kind: "PROGRAMMER_CONTRACT",
    name: "Kontrak Programmer",
    stage: 4,
    required: true,
  },
  PROGRESS_REPORT: {
    kind: "PROGRESS_REPORT",
    name: "Project Progress Report",
    stage: 6,
    required: false,
  },
  TESTING_RESULT: {
    kind: "TESTING_RESULT",
    name: "Testing Result",
    stage: 7,
    required: false,
  },
  BAST: {
    kind: "BAST",
    name: "Handover Report / BAST",
    stage: 7,
    required: true,
  },
  CLIENT_FEEDBACK: {
    kind: "CLIENT_FEEDBACK",
    name: "Client Feedback",
    stage: 8,
    required: true,
  },
  PROGRAMMER_FEEDBACK: {
    kind: "PROGRAMMER_FEEDBACK",
    name: "Programmer Feedback",
    stage: 8,
    required: true,
  },
  PROJECT_DOCUMENTATION: {
    kind: "PROJECT_DOCUMENTATION",
    name: "Project Documentation",
    stage: 9,
    required: true,
  },
  SOURCE_CODE_DOCUMENTATION: {
    kind: "SOURCE_CODE_DOCUMENTATION",
    name: "Source Code Documentation",
    stage: 9,
    required: true,
  },
};

/** Label status dokumen (PRD bab 4.4). */
export const DOCUMENT_STATUS_LABELS: Record<DocumentStatus, string> = {
  MISSING: "Belum Ada",
  IN_PROGRESS: "Dalam Proses",
  SUBMITTED: "Diajukan",
  DONE: "Selesai",
};

export const PROJECT_TYPE_LABELS = {
  DEVELOPMENT: "Development",
  ADVISORY: "Advisory",
  HIRING: "Hiring",
  DEPLOYMENT: "Deployment",
  INTEGRATION: "Integration",
  OTHER: "Other",
} as const;

export const PROJECT_SOURCE_LABELS = {
  BUSINESS_DEVELOPMENT: "Business Development",
  NON_BD: "Non-BD",
  INTERNAL: "Internal",
  GOVERNMENT: "Government",
  OTHER: "Other",
} as const;

export type ProjectType = keyof typeof PROJECT_TYPE_LABELS;
export type ProjectSource = keyof typeof PROJECT_SOURCE_LABELS;

export type UatStatus = "NOT_STARTED" | "SCHEDULED" | "PASSED" | "NEEDS_FIX";

export const UAT_STATUS_LABELS: Record<UatStatus, string> = {
  NOT_STARTED: "Belum Dimulai",
  SCHEDULED: "Dijadwalkan",
  PASSED: "Lulus",
  NEEDS_FIX: "Perlu Perbaikan",
};
