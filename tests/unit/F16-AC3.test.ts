import { describe, expect, it } from "vitest";
import type { ExistingInvoice } from "@/lib/finance/invoice";
import { reasonTerminCannotBeInvoiced } from "@/lib/finance/invoice";

const menunggu: ExistingInvoice = {
  terminSequence: 1,
  submissionStatus: "PENDING",
  currentStepLabel: "Finance POC",
};

const disetujui: ExistingInvoice = {
  terminSequence: 2,
  submissionStatus: "APPROVED",
};

const ditolak: ExistingInvoice = {
  terminSequence: 3,
  submissionStatus: "REJECTED",
};

describe("F16-AC3 Termin yang sudah punya pengajuan aktif tidak bisa diajukan lagi, dan sistem menjelaskan alasannya.", () => {
  it("Termin yang pengajuannya masih menunggu keputusan ditahan", () => {
    expect(reasonTerminCannotBeInvoiced([menunggu], 1)).not.toBeNull();
  });

  it("Alasannya menyebut nomor termin dan langkah yang sedang menunggu", () => {
    const alasan = reasonTerminCannotBeInvoiced([menunggu], 1);

    expect(alasan).toContain("Termin 1");
    expect(alasan).toContain("Finance POC");
  });

  it("Langkah yang tidak diketahui tetap menghasilkan alasan yang bisa dibaca", () => {
    const alasan = reasonTerminCannotBeInvoiced(
      [{ ...menunggu, currentStepLabel: null }],
      1,
    );

    expect(alasan).toContain("Termin 1");
    expect(alasan).toContain("belum selesai diproses");
  });

  it("Termin yang invoicenya sudah disetujui tidak bisa ditagihkan dua kali", () => {
    const alasan = reasonTerminCannotBeInvoiced([disetujui], 2);

    expect(alasan).toContain("Termin 2");
    expect(alasan).toContain("sudah punya invoice yang disetujui");
  });

  it("Pengajuan yang ditolak tidak menahan, karena memang harus bisa diajukan ulang", () => {
    expect(reasonTerminCannotBeInvoiced([ditolak], 3)).toBeNull();
  });

  it("Pengajuan aktif pada termin lain tidak ikut menahan termin ini", () => {
    expect(
      reasonTerminCannotBeInvoiced([menunggu, disetujui, ditolak], 4),
    ).toBeNull();
  });

  it("Termin tanpa invoice sama sekali boleh diajukan", () => {
    expect(reasonTerminCannotBeInvoiced([], 1)).toBeNull();
  });

  it("Pengajuan yang menunggu lebih didahulukan daripada yang sudah disetujui", () => {
    const alasan = reasonTerminCannotBeInvoiced(
      [
        { terminSequence: 1, submissionStatus: "APPROVED" },
        { ...menunggu, currentStepLabel: "CFO atau Vice CFO" },
      ],
      1,
    );

    expect(alasan).toContain("CFO atau Vice CFO");
  });
});
