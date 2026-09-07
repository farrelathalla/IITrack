import { describe, expect, it } from "vitest";
import { deriveTerminState } from "@/lib/finance/chain";
import type { FinanceQueueSnapshot } from "@/lib/finance/queue";
import {
  belongsInFinanceQueue,
  composeFinanceQueueItem,
  holdingLabelOf,
  paymentStatusOf,
} from "@/lib/finance/queue";

const JATUH_TEMPO = new Date("2026-10-01T00:00:00.000Z");
const DIAJUKAN = new Date("2026-09-01T09:00:00+07:00");
const EMPAT_JAM = new Date("2026-09-01T13:00:00+07:00");
const SABTU = new Date("2026-09-05T10:00:00+07:00");

function snapshot(
  bagian: Partial<FinanceQueueSnapshot> = {},
): FinanceQueueSnapshot {
  return {
    invoiceId: "inv-1",
    documentNumber: "#02-IIT-2627-001",
    projectId: "IIT-2627-001",
    clientName: "PT Contoh Sejahtera",
    amount: "3000000",
    dueDate: JATUH_TEMPO,
    invoiceStatus: "PENDING",
    receiptStatus: null,
    currentStepLabel: "Finance POC",
    issuedAt: DIAJUKAN,
    ...bagian,
  };
}

describe("F15-AC1 Antrean menampilkan nomor dokumen, Project ID, client, nominal, jatuh tempo, status approval dan pembayaran, approver yang sedang memegang, serta lama menunggu.", () => {
  it("Baris menunggu persetujuan memuat seluruh kolom yang dijanjikan", () => {
    const baris = composeFinanceQueueItem(snapshot(), EMPAT_JAM);

    expect(baris).toEqual({
      invoiceId: "inv-1",
      documentNumber: "#02-IIT-2627-001",
      projectId: "IIT-2627-001",
      clientName: "PT Contoh Sejahtera",
      amount: "3000000",
      dueDate: JATUH_TEMPO,
      approvalStatus: "PENDING",
      paymentStatus: "BELUM",
      state: "MENUNGGU_PERSETUJUAN",
      holdingLabel: "Finance POC",
      waitingSince: DIAJUKAN,
      waitingWorkingMinutes: 240,
    });
  });

  it("Lama menunggu dihitung dalam jam kerja, bukan jam kalender", () => {
    const baris = composeFinanceQueueItem(snapshot(), SABTU);

    // Selasa 09.00 sampai Sabtu: Selasa 8 jam, Rabu 8, Kamis 8, Jumat 8 = 1920.
    expect(baris?.waitingWorkingMinutes).toBe(1920);
  });

  it("Setelah disetujui, yang ditunggu adalah pembayaran, bukan approver", () => {
    const baris = composeFinanceQueueItem(
      snapshot({ invoiceStatus: "APPROVED", currentStepLabel: null }),
      EMPAT_JAM,
    );

    expect(baris?.state).toBe("MENUNGGU_PEMBAYARAN");
    expect(baris?.paymentStatus).toBe("MENUNGGU");
    expect(baris?.holdingLabel).toBeNull();
  });

  it("Bukti transfer yang belum divalidasi menunggu Finance POC", () => {
    const baris = composeFinanceQueueItem(
      snapshot({
        invoiceStatus: "APPROVED",
        receiptStatus: "RECORDED",
        currentStepLabel: null,
      }),
      EMPAT_JAM,
    );

    expect(baris?.state).toBe("MENUNGGU_VERIFIKASI");
    expect(baris?.paymentStatus).toBe("RECORDED");
    expect(baris?.holdingLabel).toBe("Finance POC");
  });

  it("Pengajuan ditolak dan yang sudah lunas tidak masuk antrean", () => {
    expect(
      composeFinanceQueueItem(
        snapshot({ invoiceStatus: "REJECTED" }),
        EMPAT_JAM,
      ),
    ).toBeNull();
    expect(
      composeFinanceQueueItem(
        snapshot({ invoiceStatus: "APPROVED", receiptStatus: "VALID" }),
        EMPAT_JAM,
      ),
    ).toBeNull();
    expect(belongsInFinanceQueue("DITOLAK")).toBe(false);
    expect(belongsInFinanceQueue("LUNAS")).toBe(false);
    expect(belongsInFinanceQueue("BELUM_DITAGIHKAN")).toBe(false);
  });

  it("Kata keadaan antrean sama dengan rantai Finance satu termin", () => {
    expect(
      deriveTerminState({
        terminStatus: "UNPAID",
        invoiceStatus: "PENDING",
        receiptStatus: null,
      }),
    ).toBe("MENUNGGU_PERSETUJUAN");
    expect(holdingLabelOf("MENUNGGU_PERSETUJUAN", "POC dokumentasi")).toBe(
      "POC dokumentasi",
    );
    expect(paymentStatusOf("PENDING", null)).toBe("BELUM");
  });
});
