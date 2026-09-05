import { describe, expect, it } from "vitest";
import { defaultDivisionForRole, parseDateInput } from "@/lib/member/ui";

describe("F07-T02 Helper formulir pengurus.", () => {
  it("Memilih divisi bawaan sesuai jabatan", () => {
    expect(defaultDivisionForRole("PROJECT_MANAGER")).toBe("OPERATIONAL");
    expect(defaultDivisionForRole("FINANCE_POC")).toBe("FINANCE");
    expect(defaultDivisionForRole("CTO")).toBe("TECHDEV");
  });

  it("Membaca tanggal input sebagai tengah malam WIB", () => {
    const date = parseDateInput("2026-09-01");
    expect(date).not.toBeNull();
    expect(date?.toISOString()).toBe("2026-08-31T17:00:00.000Z");
    expect(parseDateInput("bukan-tanggal")).toBeNull();
  });
});
