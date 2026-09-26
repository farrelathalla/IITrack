import { z } from "zod";
import { prisma } from "@/server/db";

/** Jenis pengajuan di Pengaturan > Workflow & Approver (PRD bab 8.7). */
export const APPROVAL_KINDS = [
  "PROJECT_CHARTER",
  "MOU",
  "PROGRAMMER_CONTRACT",
  "INVOICE",
  "DISBURSEMENT",
] as const;

export type ApprovalKind = (typeof APPROVAL_KINDS)[number];

export const APPROVAL_KIND_INFO: Record<
  ApprovalKind,
  {
    label: string;
    approverLabel: string;
    primaryHint: string;
    delegateHint: string;
  }
> = {
  PROJECT_CHARTER: {
    label: "Project Charter Review",
    approverLabel: "COO / Vice COO",
    primaryHint: "COO",
    delegateHint: "Vice COO",
  },
  MOU: {
    label: "MoU Review",
    approverLabel: "COO / Vice COO",
    primaryHint: "COO",
    delegateHint: "Vice COO",
  },
  PROGRAMMER_CONTRACT: {
    label: "Kontrak Programmer",
    approverLabel: "CTO / Vice CTO",
    primaryHint: "CTO",
    delegateHint: "Vice CTO",
  },
  INVOICE: {
    label: "Invoice dan Pembayaran",
    approverLabel: "Finance POC project",
    primaryHint: "Finance POC yang ditugaskan",
    delegateHint: "CFO / Vice CFO",
  },
  DISBURSEMENT: {
    label: "Finance Disbursement",
    approverLabel: "CFO / Vice CFO",
    primaryHint: "CFO",
    delegateHint: "Vice CFO",
  },
};

const approverSchema = z.object({
  primaryUserId: z.string().nullable().default(null),
  delegateUserId: z.string().nullable().default(null),
});

export type ApproverSetting = z.infer<typeof approverSchema>;

export interface Settings {
  approvers: Record<ApprovalKind, ApproverSetting>;
  finalStatusToleranceDays: number;
  projectIdFormat: string;
}

export const DEFAULT_SETTINGS: Settings = {
  approvers: Object.fromEntries(
    APPROVAL_KINDS.map((kind) => [
      kind,
      { primaryUserId: null, delegateUserId: null },
    ]),
  ) as Record<ApprovalKind, ApproverSetting>,
  finalStatusToleranceDays: 7,
  projectIdFormat: "IIT-[periode]-[3 digit]",
};

export async function getSettings(): Promise<Settings> {
  const rows = await prisma.setting.findMany();
  const map = new Map(rows.map((row) => [row.key, row.value]));

  const approversRaw = (map.get("approvers") ?? {}) as Record<string, unknown>;
  const approvers = { ...DEFAULT_SETTINGS.approvers };
  for (const kind of APPROVAL_KINDS) {
    const parsed = approverSchema.safeParse(approversRaw[kind] ?? {});
    if (parsed.success) approvers[kind] = parsed.data;
  }

  const tolerance = Number(map.get("finalStatusToleranceDays"));
  return {
    approvers,
    finalStatusToleranceDays:
      Number.isInteger(tolerance) && tolerance >= 0
        ? tolerance
        : DEFAULT_SETTINGS.finalStatusToleranceDays,
    projectIdFormat:
      typeof map.get("projectIdFormat") === "string"
        ? (map.get("projectIdFormat") as string)
        : DEFAULT_SETTINGS.projectIdFormat,
  };
}
