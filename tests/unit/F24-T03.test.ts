import { describe, expect, it } from "vitest";
import { AUDIT_ACTIONS } from "@/lib/audit/actions";
import {
  ACTIVITY_LIST_ALLOWS_DELETE,
  describeAuditChange,
  summarizeAuditAction,
  toActivityItem,
} from "@/lib/audit/activity";

describe("F24-T03 Riwayat aktivitas project sebagai daftar yang mudah dibaca.", () => {
  it("Setiap aksi katalog punya kalimat, bukan kunci mentah", () => {
    for (const action of Object.values(AUDIT_ACTIONS)) {
      const headline = summarizeAuditAction(action);
      expect(headline).not.toBe(action);
      expect(headline).not.toMatch(/^[a-z0-9._]+$/);
    }
  });

  it("UAT-HIST-001, pembuatan project disebut sebagai pendaftaran", () => {
    expect(summarizeAuditAction(AUDIT_ACTIONS.PROJECT_CREATED)).toBe(
      "Project didaftarkan",
    );
  });

  it("UAT-HIST-002, nilai lama dan baru tampil sebagai kalimat, bukan JSON", () => {
    const change = describeAuditChange(
      { stage: null },
      { stage: "initial_communication" },
    );
    expect(change).toBe("Tahap: Belum ditetapkan → Initial Communication");
    expect(change).not.toMatch(/[{}]/);
  });

  it("UAT-HIST-003 dan 004, persetujuan dan penolakan punya kalimat plus alasan", () => {
    expect(summarizeAuditAction(AUDIT_ACTIONS.SUBMISSION_STEP_APPROVED)).toBe(
      "Pengajuan disetujui",
    );
    const ditolak = toActivityItem({
      action: AUDIT_ACTIONS.SUBMISSION_STEP_REJECTED,
      actorName: "Dylan",
      reason: "Dokumen MoU belum lengkap.",
      createdAt: new Date("2026-09-07T03:00:00.000Z"),
      before: { status: "PENDING", langkah: 1 },
      after: { status: "REJECTED", langkah: null },
    });
    expect(ditolak.headline).toBe("Pengajuan ditolak");
    expect(ditolak.reason).toBe("Dokumen MoU belum lengkap.");
    expect(ditolak.change).toContain("Status: PENDING → REJECTED");
    expect(ditolak.actorName).toBe("Dylan");
  });

  it("UAT-HIST-005, daftar aktivitas tidak menyediakan hapus jejak", () => {
    expect(ACTIVITY_LIST_ALLOWS_DELETE).toBe(false);
  });

  it("Identitas internal seperti assignedPmId tidak dibuang ke layar", () => {
    const change = describeAuditChange(
      { assignedPmId: "clxyzlama" },
      { assignedPmId: "clxyzbaru", slaTerpenuhi: true },
    );
    expect(change).toBe("SLA: tepat waktu");
    expect(change).not.toContain("clxyz");
  });

  it("Skema termin diringkas jumlah barisnya, bukan dump array", () => {
    const change = describeAuditChange(undefined, {
      termin: [
        { nomor: 1, persentase: "30.00" },
        { nomor: 2, persentase: "70.00" },
      ],
    });
    expect(change).toBe("Skema: 2 termin");
  });
});
