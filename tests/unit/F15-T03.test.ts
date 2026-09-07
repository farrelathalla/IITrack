import { describe, expect, it } from "vitest";
import {
  canSeeFinanceQueue,
  FINANCE_QUEUE_COLUMNS,
  FINANCE_QUEUE_HREF,
  FINANCE_QUEUE_KIND_FILTERS,
  FINANCE_QUEUE_STATUS_FILTERS,
  FINANCE_SUBMISSION_DECISION_PLACEMENT,
  FINANCE_SUBMISSION_DETAIL_ROUTE,
  FINANCE_SUBMISSION_SECTIONS,
  financeSubmissionHref,
  matchesFinanceQueueFilters,
  queueKindOf,
} from "@/lib/finance/display";
import { PLANNED_MAIN_NAV, plannedNavNow } from "@/lib/ui/project-hub-layout";
import { actor, NOW } from "../support/factories";

describe("F15-T03 Rancangan halaman antrean dan halaman rincian pengajuan dikunci sebelum kode halaman.", () => {
  it("Antrean memuat seluruh kolom F15-AC1, termasuk lama menunggu", () => {
    expect(FINANCE_QUEUE_COLUMNS.map((column) => column.key)).toEqual([
      "documentNumber",
      "projectId",
      "clientName",
      "amount",
      "dueDate",
      "approvalStatus",
      "paymentStatus",
      "holdingLabel",
      "waitingWorkingMinutes",
    ]);
    expect(FINANCE_QUEUE_HREF).toBe("/finance/antrean");
  });

  it("Rincian pengajuan terpisah dari antrean, dan keputusan tidak di baris tabel", () => {
    expect(FINANCE_SUBMISSION_DETAIL_ROUTE).toBe(
      "/finance/pengajuan/[submissionId]",
    );
    expect(financeSubmissionHref("sub-1")).toBe("/finance/pengajuan/sub-1");
    expect(FINANCE_SUBMISSION_SECTIONS.map((section) => section.key)).toEqual([
      "document",
      "waiting",
      "chain",
      "decision",
    ]);
    expect(FINANCE_SUBMISSION_DECISION_PLACEMENT).toEqual({
      surface: "detail",
      route: "/finance/pengajuan/[submissionId]",
      rejectReasonRequired: true,
    });
  });

  it("F15-T02 punya penyaring jenis dan status, tanpa staffing atau Priority Zero", () => {
    expect(FINANCE_QUEUE_KIND_FILTERS.map((option) => option.value)).toEqual([
      "all",
      "invoice",
      "receipt",
    ]);
    expect(FINANCE_QUEUE_STATUS_FILTERS.map((option) => option.value)).toEqual([
      "all",
      "MENUNGGU_PERSETUJUAN",
      "MENUNGGU_PEMBAYARAN",
      "MENUNGGU_VERIFIKASI",
    ]);
    expect(queueKindOf("MENUNGGU_PERSETUJUAN")).toBe("invoice");
    expect(queueKindOf("MENUNGGU_PEMBAYARAN")).toBe("invoice");
    expect(queueKindOf("MENUNGGU_VERIFIKASI")).toBe("receipt");
    expect(
      matchesFinanceQueueFilters(
        { state: "MENUNGGU_VERIFIKASI" },
        { kind: "invoice", status: "all" },
      ),
    ).toBe(false);
    expect(
      matchesFinanceQueueFilters(
        { state: "MENUNGGU_VERIFIKASI" },
        { kind: "receipt", status: "MENUNGGU_VERIFIKASI" },
      ),
    ).toBe(true);
  });

  it("Slot nav Antrean Finance terisi now setelah halaman #77 hidup", () => {
    const finance = PLANNED_MAIN_NAV.find(
      (item) => item.key === "finance_queue",
    );
    expect(finance?.href).toBe(FINANCE_QUEUE_HREF);
    expect(finance?.availability).toBe("now");
    expect(plannedNavNow().map((item) => item.key)).toEqual([
      "beranda",
      "project",
      "client",
      "pengurus",
      "finance_queue",
    ]);
  });

  it("UAT-FIN-001/002, PM dan Finance melihat antrean; anggota TechDev tidak", () => {
    expect(canSeeFinanceQueue(actor("PROJECT_MANAGER"), NOW)).toBe(true);
    expect(canSeeFinanceQueue(actor("FINANCE_POC"), NOW)).toBe(true);
    expect(canSeeFinanceQueue(actor("CFO"), NOW)).toBe(true);
    expect(canSeeFinanceQueue(actor("TECHDEV_MEMBER"), NOW)).toBe(false);
  });
});
