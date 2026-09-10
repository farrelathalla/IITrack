import { describe, expect, it } from "vitest";
import {
  AFTER_ID_ACTIONS,
  REGISTRATION_CREATE_EXCLUSIONS,
  REGISTRATION_FIELDS,
  registrationRequiredKeys,
  TERMIN_FORM_PLACEMENT,
  TERMIN_LIVE_CHECKS,
  TERMIN_ROW_FIELDS,
  terminRequiredRowKeys,
} from "@/lib/ui/registration-termin-layout";

describe("F05-T05 Rancangan formulir daftar project dan jadwal termin dikunci sebelum kode form termin.", () => {
  it("Form daftar mewajibkan nama, client master, dan periode; nilai boleh kosong", () => {
    expect(registrationRequiredKeys()).toEqual(["name", "clientId", "period"]);
    expect(
      REGISTRATION_FIELDS.find((field) => field.key === "value")?.required,
    ).toBe(false);
    expect(
      REGISTRATION_FIELDS.find((field) => field.key === "clientId")?.control,
    ).toBe("select");
  });

  it("Jenis, PM, scope, termin, dan override ID tidak dikarang di form create", () => {
    const keys = REGISTRATION_FIELDS.map((field) => field.key);
    for (const excluded of REGISTRATION_CREATE_EXCLUSIONS) {
      expect(keys).not.toContain(excluded);
    }
    expect(REGISTRATION_CREATE_EXCLUSIONS).toEqual([
      "jenis",
      "pm",
      "scope",
      "termin",
      "overrideId",
    ]);
  });

  it("Setelah nomor terbit ada CTA ke hub untuk menyusun termin, bukan form kedua di /projects/baru", () => {
    const compose = AFTER_ID_ACTIONS.find(
      (action) => action.key === "compose_termin",
    );
    expect(compose?.href).toBe("/projects/{projectId}");
    expect(compose?.requires).toBe("project.edit_operational");
    expect(AFTER_ID_ACTIONS.map((action) => action.key)).toEqual([
      "compose_termin",
      "open_hub",
      "register_another",
    ]);
  });

  it("Form jadwal termin mengisi panel hub, bukan rute baru", () => {
    expect(TERMIN_FORM_PLACEMENT).toEqual({
      surface: "hub",
      section: "termin",
      route: "/projects/[projectId]",
    });
  });

  it("Baris termin punya nomor, jatuh tempo, serta persentase atau nominal", () => {
    expect(terminRequiredRowKeys()).toEqual(["sequence", "dueDate"]);
    const keys = TERMIN_ROW_FIELDS.map((field) => field.key);
    expect(keys).toContain("percentage");
    expect(keys).toContain("amount");
    expect(keys).toContain("label");
  });

  it("Umpan balik langsung mencakup jumlah 100 persen dan DP 25–50 sebelum submit", () => {
    expect(TERMIN_LIVE_CHECKS.map((check) => check.key)).toEqual([
      "total_percent",
      "dp_range",
    ]);
    expect(
      TERMIN_LIVE_CHECKS.find((check) => check.key === "total_percent")?.okWhen,
    ).toBe("tepat 100.00");
    expect(
      TERMIN_LIVE_CHECKS.find((check) => check.key === "dp_range")?.okWhen,
    ).toBe("25 sampai 50 inklusif");
  });
});
