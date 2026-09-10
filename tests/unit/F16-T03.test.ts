import { describe, expect, it } from "vitest";
import { canSeeAction } from "@/lib/auth/ui-visibility";
import {
  canSeeInvoiceRequestForm,
  INVOICE_AUTO_FIELDS,
  INVOICE_FORM_EXCLUSIONS,
  INVOICE_FORM_PLACEMENT,
  INVOICE_MANUAL_FIELDS,
  invoiceBlockedReason,
  parseInvoiceRequestForm,
} from "@/lib/finance/invoice-form";
import { plannedNavNow } from "@/lib/ui/project-hub-layout";
import {
  actor,
  assignedProject,
  foreignProject,
  NOW,
} from "../support/factories";

describe("F16-T03 Formulir pengajuan invoice yang sebagian besar bidangnya sudah terisi sendiri.", () => {
  it("F16-AC1, nomor, Project ID, client, nominal, dan jatuh tempo terisi sendiri", () => {
    expect([...INVOICE_AUTO_FIELDS]).toEqual([
      "number",
      "projectId",
      "clientName",
      "amount",
      "dueDate",
    ]);
    expect(INVOICE_MANUAL_FIELDS.map((field) => field.key)).toEqual([
      "description",
      "notes",
    ]);
    expect(INVOICE_MANUAL_FIELDS.every((field) => !field.required)).toBe(true);
  });

  it("Form tetap di panel Termin hub, bukan item nav baru, dan tanpa Priority Zero", () => {
    expect(INVOICE_FORM_PLACEMENT).toEqual({
      surface: "hub",
      section: "termin",
    });
    expect([...INVOICE_FORM_EXCLUSIONS]).toEqual([
      "priorityZero",
      "amount",
      "clientName",
      "projectId",
      "number",
    ]);
    expect(
      plannedNavNow().some((item) => item.href === "/projects/invoice"),
    ).toBe(false);
  });

  it("UAT-INV-001, tombol ajukan hanya untuk PM yang ditugaskan", () => {
    expect(
      canSeeInvoiceRequestForm(
        actor("PROJECT_MANAGER"),
        assignedProject("OPERATIONAL"),
        NOW,
      ),
    ).toBe(true);
    expect(
      canSeeInvoiceRequestForm(actor("PROJECT_MANAGER"), foreignProject(), NOW),
    ).toBe(false);
    expect(
      canSeeInvoiceRequestForm(
        actor("FINANCE_POC"),
        assignedProject("FINANCE"),
        NOW,
      ),
    ).toBe(false);
    expect(canSeeAction(actor("CFO"), "finance.submit", NOW)).toBe(false);
  });

  it("Pengajuan tanpa termin ditolak; keterangan boleh kosong", () => {
    const kosong = parseInvoiceRequestForm({
      terminId: "  ",
      description: "  ",
    });
    expect(kosong.ok).toBe(false);
    if (kosong.ok) return;
    expect(kosong.fields.terminId).toBeDefined();

    const lengkap = parseInvoiceRequestForm({
      terminId: "termin-1",
      description: "  Uang muka  ",
      notes: "",
    });
    expect(lengkap.ok).toBe(true);
    if (!lengkap.ok) return;
    expect(lengkap.data.description).toBe("Uang muka");
    expect(lengkap.data.notes).toBeNull();
  });

  it("Termin yang sudah lunas atau masih berpengajuan aktif tidak bisa dipilih", () => {
    expect(invoiceBlockedReason([], 1, "PAID")).toContain("sudah lunas");
    expect(
      invoiceBlockedReason(
        [{ terminSequence: 1, submissionStatus: "PENDING" }],
        1,
        "UNPAID",
      ),
    ).toContain("belum selesai");
    expect(invoiceBlockedReason([], 1, "UNPAID")).toBeNull();
  });
});
