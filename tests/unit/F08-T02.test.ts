import { describe, expect, it } from "vitest";
import {
  HUB_SECTIONS,
  hubSectionsInOrder,
  PLANNED_MAIN_NAV,
  PROJECT_LIST_COLUMNS,
  plannedNavNow,
} from "@/lib/ui/project-hub-layout";

describe("F08-T02 Rancangan halaman project dan susunan menu utama dikunci sebelum kode halaman.", () => {
  it("Menu utama memuat Beranda, Project, Client, dan Pengurus untuk fase sekarang", () => {
    const keys = plannedNavNow().map((item) => item.key);
    expect(keys).toEqual(["beranda", "project", "client", "pengurus"]);
  });

  it("Antrean Finance dipesan di nav tetapi belum availability now", () => {
    const finance = PLANNED_MAIN_NAV.find(
      (item) => item.key === "finance_queue",
    );
    expect(finance?.availability).toBe("later");
    expect(finance?.href).toBe("/finance/antrean");
  });

  it("Daftar project punya kolom inti UAT-HUB-002 dan nilai yang dijaga izin", () => {
    const keys = PROJECT_LIST_COLUMNS.map((column) => column.key);
    expect(keys).toEqual([
      "projectId",
      "name",
      "client",
      "pm",
      "stage",
      "updatedAt",
      "value",
    ]);
    expect(
      PROJECT_LIST_COLUMNS.find((column) => column.key === "value")?.requires,
    ).toBe("project.view_value");
  });

  it("Hub satu layar memuat identitas, tahap, dokumen, termin, tim, dan riwayat", () => {
    const keys = hubSectionsInOrder().map((section) => section.key);
    expect(keys).toEqual([
      "identity",
      "stage",
      "pending",
      "team",
      "documents",
      "termin",
      "history",
    ]);
  });

  it("Tim+dokumen dan termin+riwayat berpasangan dua kolom", () => {
    const team = HUB_SECTIONS.find((section) => section.key === "team");
    const documents = HUB_SECTIONS.find(
      (section) => section.key === "documents",
    );
    const termin = HUB_SECTIONS.find((section) => section.key === "termin");
    const history = HUB_SECTIONS.find((section) => section.key === "history");

    expect(team?.zone).toBe("left");
    expect(documents?.zone).toBe("right");
    expect(team?.row).toBe(documents?.row);

    expect(termin?.zone).toBe("left");
    expect(history?.zone).toBe("right");
    expect(termin?.row).toBe(history?.row);
  });
});
