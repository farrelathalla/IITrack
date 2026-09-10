import { describe, expect, it } from "vitest";
import { compareReceiptAmount } from "@/lib/finance/receipt";
import {
  canSeeReceiptForm,
  canSeeValidateReceipt,
  parseTransferProofForm,
  parseValidateReceiptForm,
  RECEIPT_AUTO_FIELDS,
  RECEIPT_FORM_EXCLUSIONS,
  RECEIPT_FORM_PLACEMENT,
  RECEIPT_MANUAL_FIELDS,
} from "@/lib/finance/receipt-form";
import {
  actor,
  assignedProject,
  foreignProject,
  NOW,
} from "../support/factories";

describe("F20-T03 Membuat formulir kuitansi beserta unggahan bukti transfer.", () => {
  it("F20-AC1, bukti menempel pada invoice; yang diisi manusia adalah tautan https, bukan berkas IITrack", () => {
    expect([...RECEIPT_AUTO_FIELDS]).toEqual([
      "number",
      "projectId",
      "invoiceNumber",
    ]);
    expect(RECEIPT_MANUAL_FIELDS.map((field) => field.key)).toEqual([
      "amount",
      "paidAt",
      "proofUrl",
      "proofNote",
    ]);
    expect([...RECEIPT_FORM_EXCLUSIONS]).toEqual([
      "fileUpload",
      "binaryStore",
      "priorityZero",
    ]);
    expect(RECEIPT_FORM_PLACEMENT.surfaces).toEqual(["hub", "detail"]);
  });

  it("Tombol catat bukti hanya untuk PM yang ditugaskan; validasi untuk Finance yang finance.edit", () => {
    expect(
      canSeeReceiptForm(
        actor("PROJECT_MANAGER"),
        assignedProject("OPERATIONAL"),
        NOW,
      ),
    ).toBe(true);
    expect(
      canSeeReceiptForm(actor("PROJECT_MANAGER"), foreignProject(), NOW),
    ).toBe(false);
    expect(
      canSeeReceiptForm(actor("FINANCE_POC"), assignedProject("FINANCE"), NOW),
    ).toBe(false);
    expect(
      canSeeValidateReceipt(
        actor("FINANCE_POC"),
        assignedProject("FINANCE"),
        NOW,
      ),
    ).toBe(true);
    expect(
      canSeeValidateReceipt(actor("FINANCE_POC"), foreignProject(), NOW),
    ).toBe(false);
    expect(
      canSeeValidateReceipt(actor("CFO"), assignedProject("FINANCE"), NOW),
    ).toBe(true);
  });

  it("Tautan http atau bukan URL ditolak; https Drive diterima", () => {
    const kosong = parseTransferProofForm({
      invoiceId: "  ",
      amount: "",
      paidAt: "",
      proofUrl: "http://drive.google.com/file/d/abc",
    });
    expect(kosong.ok).toBe(false);
    if (kosong.ok) return;
    expect(kosong.fields.invoiceId).toBeDefined();
    expect(kosong.fields.amount).toBeDefined();
    expect(kosong.fields.paidAt).toBeDefined();
    expect(kosong.fields.proofUrl).toBeDefined();

    const lengkap = parseTransferProofForm({
      invoiceId: "inv-1",
      amount: "7500000",
      paidAt: "2026-09-08",
      proofUrl: "https://drive.google.com/file/d/abc",
      proofNote: "  ",
    });
    expect(lengkap.ok).toBe(true);
    if (!lengkap.ok) return;
    expect(lengkap.data.proofUrl).toBe("https://drive.google.com/file/d/abc");
    expect(lengkap.data.proofNote).toBeNull();
    expect(lengkap.data.paidAt.toISOString()).toBe("2026-09-07T17:00:00.000Z");
  });

  it("F20-AC2, selisih terhadap invoice tetap tercatat dan peringatannya bisa dihitung", () => {
    const beda = compareReceiptAmount("7500000.00", "7400000");
    expect(beda.readable).toBe(true);
    if (!beda.readable) return;
    expect(beda.matches).toBe(false);
    expect(beda.warning).toContain("lebih kecil");
  });

  it("Validasi tanpa id kuitansi ditolak; penyelesaian boleh kosong dulu", () => {
    const kosong = parseValidateReceiptForm({ receiptId: "  " });
    expect(kosong.ok).toBe(false);

    const siap = parseValidateReceiptForm({
      receiptId: "rcp-1",
      resolution: "  Biaya transfer  ",
    });
    expect(siap.ok).toBe(true);
    if (!siap.ok) return;
    expect(siap.data.resolution).toBe("Biaya transfer");
  });
});
