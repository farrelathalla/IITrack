import { describe, expect, it } from "vitest";
import { buildInvoiceDraft } from "@/lib/finance/invoice";

const PROJECT = {
  projectId: "IIT-2627-001",
  name: "Sistem Absensi",
  clientName: "PT Contoh Sejahtera",
};

const TERMIN = {
  sequence: 1,
  percentage: "30.00",
  amount: "3000000.00",
  dueDate: new Date("2026-10-01T00:00:00.000Z"),
  status: "UNPAID" as const,
};

describe("F16-AC1 Project ID, client, dan nilai terisi otomatis, dan field manual tetap bisa dilengkapi.", () => {
  it("Nomor invoice, client, dan nominal diambil dari project dan termin, bukan dari ketikan", () => {
    const hasil = buildInvoiceDraft({ project: PROJECT, termin: TERMIN });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;

    expect(hasil.draft.number).toBe("#02-IIT-2627-001");
    expect(hasil.draft.projectId).toBe("IIT-2627-001");
    expect(hasil.draft.clientName).toBe("PT Contoh Sejahtera");
    expect(hasil.draft.amount).toBe("3000000.00");
    expect(hasil.draft.terminSequence).toBe(1);
    expect(hasil.draft.terminPercentage).toBe("30.00");
    expect(hasil.draft.dueDate).toEqual(TERMIN.dueDate);
  });

  it("Keterangan manual ikut terbawa apa adanya", () => {
    const hasil = buildInvoiceDraft({
      project: PROJECT,
      termin: TERMIN,
      manual: {
        description: "Uang muka pembangunan sistem",
        notes: "Ditagihkan setelah MoU ditandatangani",
      },
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;

    expect(hasil.draft.description).toBe("Uang muka pembangunan sistem");
    expect(hasil.draft.notes).toBe("Ditagihkan setelah MoU ditandatangani");
  });

  it("Keterangan yang belum diisi menjadi kosong, bukan spasi", () => {
    const hasil = buildInvoiceDraft({
      project: PROJECT,
      termin: TERMIN,
      manual: { description: "   ", notes: undefined },
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;

    expect(hasil.draft.description).toBeNull();
    expect(hasil.draft.notes).toBeNull();
  });

  it("Isian manual tidak punya jalan untuk mengubah nilai tagihan", () => {
    const manual = {
      description: "Uang muka",
      notes: "catatan",
      // Bidang otomatis sengaja tidak ada pada tipe isian manual. Bila suatu
      // saat ditambahkan, test ini yang lebih dulu gagal.
      amount: "999999999.00",
      clientName: "PT Bukan Client Ini",
    } as unknown as { description: string; notes: string };

    const hasil = buildInvoiceDraft({
      project: PROJECT,
      termin: TERMIN,
      manual,
    });

    expect(hasil.ok).toBe(true);
    if (!hasil.ok) return;

    expect(hasil.draft.amount).toBe("3000000.00");
    expect(hasil.draft.clientName).toBe("PT Contoh Sejahtera");
  });

  it("Termin yang sudah lunas tidak bisa dibuatkan invoice", () => {
    const hasil = buildInvoiceDraft({
      project: PROJECT,
      termin: { ...TERMIN, status: "PAID" },
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;

    expect(hasil.reason).toContain("sudah lunas");
  });

  it("Nomor project yang bentuknya salah tidak menghasilkan nomor invoice", () => {
    const hasil = buildInvoiceDraft({
      project: { ...PROJECT, projectId: "IIT-001" },
      termin: TERMIN,
    });

    expect(hasil.ok).toBe(false);
    if (hasil.ok) return;

    expect(hasil.reason).toContain("format resmi");
  });
});
