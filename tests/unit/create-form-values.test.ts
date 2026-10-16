import { describe, expect, it } from "vitest";
import { createProjectFormValues } from "@/app/(internal)/projects/new/form-values";

describe("createProjectFormValues", () => {
  it("menyalin semua isian termasuk yang opsional kosong", () => {
    const form = new FormData();
    form.set("name", "Uji Field");
    form.set("client", "PT Client");
    form.set("type", "INTERNAL");
    form.set("source", "WALK_IN");
    form.set("pmUserId", "user-pm");
    form.set("targetStart", "2026-10-01");
    form.set("targetEnd", "2026-12-31");
    form.set("internalNote", "catatan");
    form.set("manualCode", "ABC");

    expect(createProjectFormValues(form)).toEqual({
      name: "Uji Field",
      client: "PT Client",
      type: "INTERNAL",
      source: "WALK_IN",
      pmUserId: "user-pm",
      targetStart: "2026-10-01",
      targetEnd: "2026-12-31",
      internalNote: "catatan",
      manualCode: "ABC",
    });
  });

  it("mengisi string kosong bila field tidak dikirim", () => {
    expect(createProjectFormValues(new FormData()).manualCode).toBe("");
    expect(createProjectFormValues(new FormData()).pmUserId).toBe("");
  });
});
