import { describe, expect, it } from "vitest";
import { can } from "@/lib/auth/permissions";
import type { StageDefinition } from "@/lib/project/stages";
import {
  STAGE_CATALOGUE,
  stageTargetsForSelect,
  suggestedStageTarget,
} from "@/lib/project/stages";
import {
  actor,
  assignedProject,
  foreignProject,
  NOW,
} from "../support/factories";

const CONTOH: readonly StageDefinition[] = [
  { key: "tahap_satu", order: 1, label: "Tahap Satu" },
  { key: "tahap_dua", order: 2, label: "Tahap Dua" },
  { key: "tahap_tiga", order: 3, label: "Tahap Tiga" },
];

describe("F09-T02 Menampilkan tahap berjalan dan tombol mengajukan perpindahan.", () => {
  it("Formulir hanya menawarkan tahap katalog selain yang sedang berjalan", () => {
    expect(
      stageTargetsForSelect(CONTOH, "tahap_dua").map((stage) => stage.key),
    ).toEqual(["tahap_satu", "tahap_tiga"]);
  });

  it("Usulan tujuan adalah tahap berikutnya, atau tahap pertama bila belum ditetapkan", () => {
    expect(suggestedStageTarget(CONTOH, "tahap_satu")?.key).toBe("tahap_dua");
    expect(suggestedStageTarget(CONTOH, null)?.key).toBe("tahap_satu");
    expect(suggestedStageTarget(CONTOH, "tahap_tiga")?.key).toBe("tahap_satu");
  });

  it("Katalog resmi yang belum lengkap tidak dikarang namanya di formulir", () => {
    expect(
      stageTargetsForSelect(STAGE_CATALOGUE, null).map((stage) => stage.key),
    ).toEqual(["initial_communication", "revenue_share_prerequisites"]);
  });

  it("UAT-STAGE-001, COO dan PM yang ditugaskan boleh memindahkan tahap", () => {
    expect(
      can({
        actor: actor("COO"),
        action: "stage.change",
        project: foreignProject(),
        now: NOW,
      }),
    ).toBe(true);
    expect(
      can({
        actor: actor("PROJECT_MANAGER"),
        action: "stage.change",
        project: assignedProject("OPERATIONAL"),
        now: NOW,
      }),
    ).toBe(true);
  });

  it("UAT-STAGE-002, tombol disembunyikan untuk yang tidak berwenang dan permintaan langsung tetap ditolak", () => {
    expect(
      can({
        actor: actor("FINANCE_POC"),
        action: "stage.change",
        project: assignedProject("FINANCE"),
        now: NOW,
      }),
    ).toBe(false);
    expect(
      can({
        actor: actor("PROJECT_MANAGER"),
        action: "stage.change",
        project: foreignProject(),
        now: NOW,
      }),
    ).toBe(false);
    expect(
      can({
        actor: actor("COO"),
        action: "stage.change",
        now: NOW,
      }),
    ).toBe(false);
  });
});
