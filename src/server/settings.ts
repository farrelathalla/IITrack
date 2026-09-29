import { z } from "zod";
import type {
  ApprovalKind,
  ApproverRule,
  ApproverRules,
} from "@/lib/auth/access";
import { ROLE_LABELS } from "@/lib/auth/roles";
import type { RoleName } from "@/lib/auth/types";
import type { Tx } from "@/server/activity";
import { prisma } from "@/server/db";

export type { ApprovalKind } from "@/lib/auth/access";

/** Jenis pengajuan di Pengaturan > Workflow & Approver (PRD bab 8.7). */
export const APPROVAL_KINDS: readonly ApprovalKind[] = [
  "PROJECT_CHARTER",
  "CHARTER_TECH",
  "MOU",
  "PROGRAMMER_CONTRACT",
  "INVOICE",
  "DISBURSEMENT",
];

/**
 * Jabatan yang boleh dipilih sebagai approver utama dan delegasi. Untuk
 * INVOICE, approver utamanya selalu Finance POC project, jadi yang dipilih
 * hanya cadangannya.
 */
export const APPROVER_ROLES: Record<ApprovalKind, readonly RoleName[]> = {
  PROJECT_CHARTER: ["COO", "VICE_COO"],
  CHARTER_TECH: ["CTO", "VICE_CTO"],
  MOU: ["COO", "VICE_COO"],
  PROGRAMMER_CONTRACT: ["CTO", "VICE_CTO"],
  INVOICE: ["CFO", "VICE_CFO"],
  DISBURSEMENT: ["CFO", "VICE_CFO"],
};

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
    label: "Project Charter (sisi Operasional)",
    approverLabel: "COO / Vice COO",
    primaryHint: "COO",
    delegateHint: "Vice COO",
  },
  CHARTER_TECH: {
    label: "Project Charter (sisi Tech)",
    approverLabel: "CTO / Vice CTO",
    primaryHint: "CTO",
    delegateHint: "Vice CTO",
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

/**
 * Approver yang berlaku saat ini. Orang yang dipilih tetapi sudah tidak
 * memegang jabatan approver diabaikan; bila tidak ada yang tersisa, aturannya
 * kosong dan semua pemegang jabatan kembali boleh memutuskan, supaya pengajuan
 * tidak pernah tersangkut tanpa approver.
 */
export async function loadApproverRules(
  client: Tx | typeof prisma = prisma,
  now: Date = new Date(),
): Promise<ApproverRules> {
  const row = await client.setting.findUnique({ where: { key: "approvers" } });
  const raw = (row?.value ?? {}) as Record<string, unknown>;
  const chosen = new Map<ApprovalKind, string[]>();
  for (const kind of APPROVAL_KINDS) {
    const parsed = approverSchema.safeParse(raw[kind] ?? {});
    if (!parsed.success) continue;
    const ids =
      kind === "INVOICE"
        ? [parsed.data.delegateUserId]
        : [parsed.data.primaryUserId, parsed.data.delegateUserId];
    const unique = [...new Set(ids.filter((id): id is string => Boolean(id)))];
    if (unique.length > 0) chosen.set(kind, unique);
  }
  if (chosen.size === 0) return {};

  const holders = await client.roleAssignment.findMany({
    where: {
      userId: { in: [...new Set([...chosen.values()].flat())] },
      OR: [{ endedAt: null }, { endedAt: { gt: now } }],
      period: { startDate: { lte: now }, endDate: { gt: now } },
      user: { status: "ACTIVE" },
    },
    select: { userId: true, role: true, user: { select: { name: true } } },
  });

  const rules: ApproverRules = {};
  for (const [kind, ids] of chosen) {
    const eligible = ids
      .map((id) =>
        holders.find(
          (h) => h.userId === id && APPROVER_ROLES[kind].includes(h.role),
        ),
      )
      .filter((h): h is (typeof holders)[number] => Boolean(h));
    if (eligible.length === 0) continue;
    const rule: ApproverRule = {
      userIds: eligible.map((h) => h.userId),
      names: eligible
        .map((h) => `${h.user.name} (${ROLE_LABELS[h.role]})`)
        .join(" atau "),
    };
    rules[kind] = rule;
  }
  return rules;
}
