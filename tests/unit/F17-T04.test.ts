import { describe, expect, it } from "vitest";
import {
  canSeeSubmissionDecision,
  parseSubmissionDecisionForm,
  SUBMISSION_DECISION_BUTTONS,
  SUBMISSION_DECISION_PLACEMENT,
} from "@/lib/finance/decision";
import { FINANCE_QUEUE_COLUMNS } from "@/lib/finance/display";
import type { FinanceQueueItem } from "@/lib/finance/queue";
import { actor, NOW } from "../support/factories";

const JATUH_TEMPO = new Date("2026-10-01T00:00:00.000Z");
const MASUK = new Date("2026-09-01T09:00:00+07:00");

function item(bagian: Partial<FinanceQueueItem> = {}): FinanceQueueItem {
  return {
    invoiceId: "inv-1",
    submissionId: "sub-1",
    projectDbId: "proj-1",
    receiptId: null,
    documentNumber: "#02-IIT-2627-001",
    projectId: "IIT-2627-001",
    clientName: "PT Contoh Sejahtera",
    amount: "7500000.00",
    dueDate: JATUH_TEMPO,
    approvalStatus: "PENDING",
    paymentStatus: "BELUM",
    state: "MENUNGGU_PERSETUJUAN",
    holdingLabel: "Finance POC",
    waitingSince: MASUK,
    waitingWorkingMinutes: 240,
    ...bagian,
  };
}

describe("F17-T04 Membuat halaman rincian pengajuan beserta tombol setuju dan tolak.", () => {
  it("Tombol keputusan hanya di rincian, bukan kolom antrean", () => {
    expect(SUBMISSION_DECISION_PLACEMENT).toEqual({
      surface: "detail",
      route: "/finance/pengajuan/[submissionId]",
      rejectReasonRequired: true,
    });
    expect(
      FINANCE_QUEUE_COLUMNS.some((column) =>
        column.label.toLowerCase().includes("setuju"),
      ),
    ).toBe(false);
    expect(
      SUBMISSION_DECISION_BUTTONS.map((button) => button.decision),
    ).toEqual(["APPROVED", "REJECTED"]);
  });

  it("F17-AC1, pengaju tidak memilih rantainya; tombol mengikuti langkah yang sedang berjalan", () => {
    expect(canSeeSubmissionDecision(actor("FINANCE_POC"), item(), NOW)).toBe(
      true,
    );
    expect(
      canSeeSubmissionDecision(
        actor("CFO"),
        item({ holdingLabel: "CFO atau Vice CFO" }),
        NOW,
      ),
    ).toBe(true);
    expect(canSeeSubmissionDecision(actor("CFO"), item(), NOW)).toBe(false);
    expect(
      canSeeSubmissionDecision(actor("OFFICER_OPERATIONAL"), item(), NOW),
    ).toBe(false);
  });

  it("F17-AC3, penolakan wajib mengisi alasan", () => {
    const tanpaAlasan = parseSubmissionDecisionForm({
      submissionId: "sub-1",
      decision: "REJECTED",
      reason: "   ",
    });
    expect(tanpaAlasan.ok).toBe(false);
    if (tanpaAlasan.ok) return;
    expect(tanpaAlasan.fields.reason).toBeDefined();
    expect(tanpaAlasan.reason).toContain("alasan");

    const beralasan = parseSubmissionDecisionForm({
      submissionId: "sub-1",
      decision: "REJECTED",
      reason: "Nominalnya tidak cocok dengan termin.",
    });
    expect(beralasan.ok).toBe(true);
    if (!beralasan.ok) return;
    expect(beralasan.data.reason).toBe("Nominalnya tidak cocok dengan termin.");
  });

  it("F17-AC4, pengguna tanpa wewenang tidak melihat tombol, termasuk PM yang finance.view", () => {
    expect(
      canSeeSubmissionDecision(actor("PROJECT_MANAGER"), item(), NOW),
    ).toBe(false);
    expect(canSeeSubmissionDecision(actor("COO"), item(), NOW)).toBe(false);
    expect(canSeeSubmissionDecision(actor("TECHDEV_MEMBER"), item(), NOW)).toBe(
      false,
    );
  });

  it("Menunggu pembayaran atau verifikasi kuitansi tidak punya tombol setuju/tolak", () => {
    expect(
      canSeeSubmissionDecision(
        actor("FINANCE_POC"),
        item({
          state: "MENUNGGU_PEMBAYARAN",
          holdingLabel: null,
          approvalStatus: "APPROVED",
          paymentStatus: "MENUNGGU",
        }),
        NOW,
      ),
    ).toBe(false);
    expect(
      canSeeSubmissionDecision(
        actor("FINANCE_POC"),
        item({
          state: "MENUNGGU_VERIFIKASI",
          holdingLabel: "Finance POC",
          approvalStatus: "APPROVED",
          paymentStatus: "RECORDED",
        }),
        NOW,
      ),
    ).toBe(false);
  });

  it("Persetujuan tidak mewajibkan alasan; keputusan yang tidak dikenal ditolak", () => {
    const setuju = parseSubmissionDecisionForm({
      submissionId: "sub-1",
      decision: "APPROVED",
    });
    expect(setuju.ok).toBe(true);
    if (!setuju.ok) return;
    expect(setuju.data.reason).toBeNull();

    const asing = parseSubmissionDecisionForm({
      submissionId: "sub-1",
      decision: "P0",
    });
    expect(asing.ok).toBe(false);
  });
});
