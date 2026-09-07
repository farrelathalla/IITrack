import { describe, expect, it } from "vitest";
import { visibleMainNav } from "@/lib/auth/ui-visibility";
import {
  canSeeFinanceQueue,
  FINANCE_QUEUE_COLUMNS,
  FINANCE_QUEUE_HREF,
  filterFinanceQueueItems,
  financeApprovalLabel,
  financeHoldingDisplay,
  financePaymentLabel,
  parseFinanceQueueSearchParams,
} from "@/lib/finance/display";
import { plannedNavNow } from "@/lib/ui/project-hub-layout";
import { actor, NOW } from "../support/factories";

describe("F15-T02 Halaman antrean Finance beserta penyaring jenis dan status, serta kolom lama menunggu.", () => {
  it("Kolom lama menunggu ada di tabel, dan nav memakai rute yang dikunci F15-T03", () => {
    expect(
      FINANCE_QUEUE_COLUMNS.some(
        (column) => column.key === "waitingWorkingMinutes",
      ),
    ).toBe(true);
    expect(
      plannedNavNow().some((item) => item.href === FINANCE_QUEUE_HREF),
    ).toBe(true);
  });

  it("Query jenis dan status yang tidak dikenal jatuh ke semua, bukan mengosongkan daftar", () => {
    expect(parseFinanceQueueSearchParams({})).toEqual({
      kind: "all",
      status: "all",
    });
    expect(
      parseFinanceQueueSearchParams({ jenis: "p0", status: "LUNAS" }),
    ).toEqual({ kind: "all", status: "all" });
    expect(
      parseFinanceQueueSearchParams({
        jenis: "receipt",
        status: "MENUNGGU_VERIFIKASI",
      }),
    ).toEqual({ kind: "receipt", status: "MENUNGGU_VERIFIKASI" });
  });

  it("Penyaring jenis memisahkan invoice dari kuitansi", () => {
    const items = [
      { state: "MENUNGGU_PERSETUJUAN" as const },
      { state: "MENUNGGU_VERIFIKASI" as const },
    ];
    expect(
      filterFinanceQueueItems(items, { kind: "invoice", status: "all" }),
    ).toEqual([{ state: "MENUNGGU_PERSETUJUAN" }]);
    expect(
      filterFinanceQueueItems(items, { kind: "receipt", status: "all" }),
    ).toEqual([{ state: "MENUNGGU_VERIFIKASI" }]);
  });

  it("Label status dan pemegang siap dibaca manusia", () => {
    expect(financeApprovalLabel("PENDING")).toBe("Menunggu");
    expect(financePaymentLabel("BELUM")).toBe("Belum dibayar");
    expect(
      financeHoldingDisplay({
        holdingLabel: null,
        state: "MENUNGGU_PEMBAYARAN",
      }),
    ).toBe("Pembayaran");
  });

  it("PM dan Finance melihat item nav; anggota TechDev mendapat 404 di pintu tampilan", () => {
    expect(
      visibleMainNav(actor("FINANCE_POC"), NOW).some(
        (item) => item.href === FINANCE_QUEUE_HREF,
      ),
    ).toBe(true);
    expect(
      visibleMainNav(actor("PROJECT_MANAGER"), NOW).some(
        (item) => item.href === FINANCE_QUEUE_HREF,
      ),
    ).toBe(true);
    expect(
      visibleMainNav(actor("TECHDEV_MEMBER"), NOW).some(
        (item) => item.href === FINANCE_QUEUE_HREF,
      ),
    ).toBe(false);
    expect(canSeeFinanceQueue(actor("TECHDEV_MEMBER"), NOW)).toBe(false);
  });
});
