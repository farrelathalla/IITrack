import { describe, expect, it } from "vitest";
import {
  formatProjectValue,
  stageLabel,
  summarizeAuditAction,
  visibleProjectListColumns,
} from "@/lib/project/hub-display";
import { actor, NOW } from "../support/factories";

describe("F08-T01 Halaman project memuat identitas, tahap, dokumen, termin, tim, dan riwayat dalam satu layar.", () => {
  it("Memformat nilai project ke Rupiah dan mengembalikan null bila kosong", () => {
    const formatted = formatProjectValue("25000000")?.replace(/\s/g, "");
    expect(formatted).toBe("Rp25.000.000");
    expect(formatProjectValue(null)).toBeNull();
  });

  it("Menyebut tahap dari katalog atau menandai belum ditetapkan", () => {
    expect(stageLabel("initial_communication")).toBe("Initial Communication");
    expect(stageLabel(null)).toBe("Belum ditetapkan");
    expect(stageLabel("tahap_belum_resmi")).toBe("tahap_belum_resmi");
  });

  it("Meringkas aksi audit project untuk panel riwayat", () => {
    expect(summarizeAuditAction("project.created")).toBe("Project didaftarkan");
    expect(summarizeAuditAction("project.pm_assigned")).toBe("PM ditugaskan");
  });

  it("Kolom nilai hanya muncul bila actor boleh project.view_value", () => {
    const pmKeys = visibleProjectListColumns(actor("PROJECT_MANAGER"), NOW).map(
      (column) => column.key,
    );
    const cooKeys = visibleProjectListColumns(actor("COO"), NOW).map(
      (column) => column.key,
    );

    // PM tanpa penugasan project tidak punya view_value global.
    expect(pmKeys).not.toContain("value");
    expect(cooKeys).toContain("value");
  });
});
