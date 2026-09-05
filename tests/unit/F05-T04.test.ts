import { describe, expect, it } from "vitest";
import { parseOptionalProjectValue } from "@/lib/project/registration-form";

describe("F05-T04 Parsing isian nilai pada formulir pendaftaran.", () => {
  it("Menganggap string kosong sebagai nilai yang tidak diisi", () => {
    expect(parseOptionalProjectValue("")).toEqual({ ok: true, value: null });
    expect(parseOptionalProjectValue("   ")).toEqual({ ok: true, value: null });
  });

  it("Menerima angka dengan titik atau koma desimal", () => {
    expect(parseOptionalProjectValue("1500000")).toEqual({
      ok: true,
      value: 1_500_000,
    });
    expect(parseOptionalProjectValue("12,5")).toEqual({
      ok: true,
      value: 12.5,
    });
  });

  it("Menolak teks yang bukan angka", () => {
    const result = parseOptionalProjectValue("dua juta");
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("angka");
  });
});
