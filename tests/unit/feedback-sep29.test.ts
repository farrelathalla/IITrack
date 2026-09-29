import { describe, expect, it } from "vitest";
import {
  type ApproverRules,
  canManageApprover,
  canOnProject,
  type ProjectAction,
} from "@/lib/auth/access";
import type { RoleName } from "@/lib/auth/types";
import {
  deriveStages,
  requirementMetAt,
  stageRequirements,
} from "@/lib/project/stages";
import {
  access,
  DEV_ID,
  doc,
  emptyProject,
  FIN_ID,
  NOW,
  PM_ID,
  projectThroughStage4,
  submission,
  viewer,
} from "../support/factories";

function allowed(
  role: RoleName,
  userId: string,
  action: ProjectAction,
  approvers?: ApproverRules,
): boolean {
  return canOnProject(viewer(role, userId), action, access({ approvers }))
    .allowed;
}

describe("Feedback 29 Sep: edit detail dan hapus project", () => {
  it("detail bisa diubah PM project dan COO/VCOO, bukan PM lain atau C-Level lain", () => {
    expect(allowed("PROJECT_MANAGER", PM_ID, "project.edit")).toBe(true);
    expect(allowed("COO", "coo", "project.edit")).toBe(true);
    expect(allowed("VICE_COO", "vcoo", "project.edit")).toBe(true);
    expect(allowed("PROJECT_MANAGER", "pm-lain", "project.edit")).toBe(false);
    expect(allowed("CTO", "cto", "project.edit")).toBe(false);
  });

  it("hanya COO/VCOO yang bisa menghapus project, dan tidak setelah ditutup", () => {
    expect(allowed("COO", "coo", "project.delete")).toBe(true);
    expect(allowed("PROJECT_MANAGER", PM_ID, "project.delete")).toBe(false);
    expect(
      canOnProject(
        viewer("COO", "coo"),
        "project.delete",
        access({ closed: true }),
      ).allowed,
    ).toBe(false);
  });
});

describe("Feedback 29 Sep: approver yang dipilih benar-benar berlaku", () => {
  const rules: ApproverRules = {
    MOU: { userIds: ["coo-rina"], names: "Rina (COO)" },
    PROGRAMMER_CONTRACT: { userIds: ["vcto-dimas"], names: "Dimas (Vice CTO)" },
    INVOICE: { userIds: ["vcfo-sari"], names: "Sari (Vice CFO)" },
    DISBURSEMENT: { userIds: ["cfo-budi"], names: "Budi (CFO)" },
  };

  it("tanpa pilihan, semua pemegang jabatan approver boleh memutuskan", () => {
    expect(allowed("COO", "coo-rina", "mou.decide")).toBe(true);
    expect(allowed("VICE_COO", "vcoo-lain", "mou.decide")).toBe(true);
  });

  it("dengan pilihan, hanya approver terpilih yang boleh, dengan alasan yang jelas", () => {
    expect(allowed("COO", "coo-rina", "mou.decide", rules)).toBe(true);
    const denied = canOnProject(
      viewer("VICE_COO", "vcoo-lain"),
      "mou.decide",
      access({ approvers: rules }),
    );
    expect(denied).toEqual({
      allowed: false,
      reason:
        "Pengajuan ini diputuskan oleh Rina (COO), sesuai Pengaturan > Workflow & Approver.",
    });
    // Project Charter tidak diatur, jadi tetap semua COO/VCOO.
    expect(allowed("VICE_COO", "vcoo-lain", "charter.decide", rules)).toBe(
      true,
    );
    expect(allowed("CTO", "cto-lain", "contract.decide", rules)).toBe(false);
    expect(allowed("VICE_CTO", "vcto-dimas", "contract.decide", rules)).toBe(
      true,
    );
    expect(allowed("CFO", "cfo-budi", "disbursement.decide", rules)).toBe(true);
    expect(allowed("VICE_CFO", "vcfo-sari", "disbursement.decide", rules)).toBe(
      false,
    );
  });

  it("pilihan tidak memberi wewenang ke jabatan yang salah", () => {
    const wrong: ApproverRules = {
      MOU: { userIds: ["cto-x"], names: "X (CTO)" },
    };
    expect(allowed("CTO", "cto-x", "mou.decide", wrong)).toBe(false);
  });

  it("Finance POC project selalu boleh; cadangannya dipersempit ke yang dipilih", () => {
    expect(allowed("FINANCE_POC", FIN_ID, "term.finance", rules)).toBe(true);
    expect(allowed("VICE_CFO", "vcfo-sari", "term.finance", rules)).toBe(true);
    expect(allowed("CFO", "cfo-budi", "term.finance", rules)).toBe(false);
    expect(allowed("CFO", "cfo-budi", "term.finance")).toBe(true);
  });

  it("C-Level hanya mengatur approver divisinya, Super Admin semua", () => {
    expect(canManageApprover("COO", "MOU")).toBe(true);
    expect(canManageApprover("COO", "PROGRAMMER_CONTRACT")).toBe(false);
    expect(canManageApprover("VICE_CTO", "PROGRAMMER_CONTRACT")).toBe(true);
    expect(canManageApprover("CFO", "INVOICE")).toBe(true);
    expect(canManageApprover("PROJECT_MANAGER", "MOU")).toBe(false);
    expect(canManageApprover("SUPER_ADMIN", "DISBURSEMENT")).toBe(true);
  });
});

describe("Feedback 29 Sep: syarat stage terlihat, termasuk tanda tangan", () => {
  it("MoU disetujui tetapi belum ditandai: hanya langkah tanda tangan yang kurang", () => {
    const mou = doc("MOU");
    const charter = doc("PROJECT_CHARTER");
    const project = projectThroughStage4({
      documents: [doc("REQUIREMENT_GATHERING"), charter, mou],
      submissions: [
        submission("PROJECT_CHARTER", charter, "APPROVED"),
        submission("MOU", mou, "APPROVED"),
      ],
    });
    const items = stageRequirements(project, 3, NOW);
    expect(
      items.filter((item) => !item.done).map((item) => item.label),
    ).toEqual(["Klik Tandai Ditandatangani setelah client tanda tangan"]);
    expect(requirementMetAt(project, 3, NOW)).toBeNull();
  });

  it("Stage 4 menyebut kontrak per developer yang belum ditandatangani", () => {
    const contract = doc("PROGRAMMER_CONTRACT", { developerId: DEV_ID });
    const base = projectThroughStage4();
    const project = {
      ...base,
      documents: [
        ...base.documents.filter((d) => d.kind !== "PROGRAMMER_CONTRACT"),
        contract,
      ],
      submissions: [
        ...base.submissions.filter((s) => s.kind !== "PROGRAMMER_CONTRACT"),
        submission("PROGRAMMER_CONTRACT", contract, "APPROVED"),
      ],
    };
    const open = stageRequirements(project, 4, NOW).filter((i) => !i.done);
    expect(open).toHaveLength(1);
    expect(open[0].label).toMatch(/^Tandai Kontrak .* Ditandatangani$/);
  });

  it("checklist selesai semua tepat saat stage selesai", () => {
    const project = projectThroughStage4();
    for (const n of [1, 2, 3, 4] as const) {
      expect(stageRequirements(project, n, NOW).every((i) => i.done)).toBe(
        true,
      );
      expect(requirementMetAt(project, n, NOW)).not.toBeNull();
    }
    const fresh = emptyProject();
    expect(stageRequirements(fresh, 1, NOW).map((i) => i.done)).toEqual([
      false,
      false,
    ]);
    expect(deriveStages(fresh, NOW)[0].status).toBe("not-started");
  });
});

describe("Jawaban CTO 29 Sep: checklist Charter dua sisi", () => {
  it("persetujuan COO saja mencentang sisi COO, sisi CTO masih kurang", () => {
    const charter = doc("PROJECT_CHARTER");
    const project = emptyProject({
      documents: [doc("REQUIREMENT_GATHERING"), charter],
      submissions: [
        submission("PROJECT_CHARTER", charter, "PENDING", {
          opsApprovedAt: NOW,
          opsApprovedByName: "Ghazy",
        }),
      ],
    });
    const open = stageRequirements(project, 2, NOW).filter((i) => !i.done);
    expect(open.map((i) => i.label)).toEqual(["Disetujui CTO / Vice CTO"]);
    expect(requirementMetAt(project, 2, NOW)).toBeNull();
  });

  it("sisi Tech Charter hanya CTO/VCTO, dan pilihan approvernya berlaku", () => {
    expect(allowed("CTO", "cto", "charter.decideTech")).toBe(true);
    expect(allowed("VICE_CTO", "vcto", "charter.decideTech")).toBe(true);
    expect(allowed("COO", "coo", "charter.decideTech")).toBe(false);
    const rules: ApproverRules = {
      CHARTER_TECH: { userIds: ["vcto"], names: "V (Vice CTO)" },
    };
    expect(allowed("CTO", "cto", "charter.decideTech", rules)).toBe(false);
    expect(allowed("VICE_CTO", "vcto", "charter.decideTech", rules)).toBe(true);
    expect(canManageApprover("CTO", "CHARTER_TECH")).toBe(true);
    expect(canManageApprover("COO", "CHARTER_TECH")).toBe(false);
  });
});
