import { describe, expect, it } from "vitest";
import { buildApprovalChain } from "@/lib/approval/chain";
import { decideStep } from "@/lib/approval/progress";

const RANTAI_INVOICE = buildApprovalChain("INVOICE");
const RANTAI_SATU_LANGKAH = buildApprovalChain("STAFFING_REQUEST");

describe("F17-AC2 Setiap langkah mencatat approver, keputusan, alasan, dan waktu, lalu meneruskan ke langkah berikutnya.", () => {
  it("Persetujuan pada langkah pertama meneruskan ke langkah kedua", () => {
    const hasil = decideStep({
      chain: RANTAI_INVOICE,
      currentOrder: 1,
      decision: "APPROVED",
    });

    expect(hasil.valid).toBe(true);
    if (!hasil.valid) return;
    expect(hasil.result).toEqual({ outcome: "advanced", nextStepOrder: 2 });
  });

  it("Persetujuan pada langkah terakhir menyelesaikan pengajuan", () => {
    const hasil = decideStep({
      chain: RANTAI_INVOICE,
      currentOrder: 3,
      decision: "APPROVED",
    });

    expect(hasil.valid).toBe(true);
    if (!hasil.valid) return;
    expect(hasil.result).toEqual({ outcome: "approved" });
  });

  it("Rantai satu langkah langsung selesai setelah disetujui", () => {
    const hasil = decideStep({
      chain: RANTAI_SATU_LANGKAH,
      currentOrder: 1,
      decision: "APPROVED",
    });

    expect(hasil.valid).toBe(true);
    if (!hasil.valid) return;
    expect(hasil.result).toEqual({ outcome: "approved" });
  });

  it("Langkah yang tidak ada di rantai ditolak, bukan diloloskan", () => {
    const hasil = decideStep({
      chain: RANTAI_INVOICE,
      currentOrder: 9,
      decision: "APPROVED",
    });

    expect(hasil.valid).toBe(false);
  });
});

describe("F17-AC3 Penolakan wajib mengisi alasan, dan pengajuan yang ditolak bisa diperbaiki tanpa kehilangan riwayat.", () => {
  it("UAT-APR-003, penolakan tanpa alasan ditolak sistem", () => {
    const hasil = decideStep({
      chain: RANTAI_INVOICE,
      currentOrder: 1,
      decision: "REJECTED",
    });

    expect(hasil.valid).toBe(false);
    if (hasil.valid) return;
    expect(hasil.reason.split(" ").length).toBeGreaterThan(3);
  });

  it("Alasan yang hanya berisi spasi dianggap kosong", () => {
    const hasil = decideStep({
      chain: RANTAI_INVOICE,
      currentOrder: 1,
      decision: "REJECTED",
      reason: "    ",
    });

    expect(hasil.valid).toBe(false);
  });

  it("Penolakan beralasan menghentikan pengajuan pada langkah mana pun", () => {
    for (const order of [1, 2, 3]) {
      const hasil = decideStep({
        chain: RANTAI_INVOICE,
        currentOrder: order,
        decision: "REJECTED",
        reason: "Nominalnya tidak cocok dengan termin.",
      });

      expect(hasil.valid).toBe(true);
      if (!hasil.valid) continue;
      expect(hasil.result).toEqual({ outcome: "rejected" });
    }
  });

  it("Persetujuan tidak mewajibkan alasan", () => {
    const hasil = decideStep({
      chain: RANTAI_INVOICE,
      currentOrder: 1,
      decision: "APPROVED",
    });

    expect(hasil.valid).toBe(true);
  });
});
