import { describe, expect, it } from "vitest";
import { isValidLink } from "@/lib/validation";

describe("isValidLink", () => {
  it("menerima https", () => {
    expect(isValidLink("https://docs.google.com/document/d/e2e")).toBe(true);
  });

  it("menolak http, meski URL-nya valid", () => {
    expect(isValidLink("http://bukan-https")).toBe(false);
    expect(isValidLink("http://example.com/file")).toBe(false);
  });

  it("menolak yang bukan URL", () => {
    expect(isValidLink("bukan-url")).toBe(false);
    expect(isValidLink("")).toBe(false);
  });
});
