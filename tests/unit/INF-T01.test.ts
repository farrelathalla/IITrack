import { describe, expect, it } from "vitest";
import { cn } from "@/lib/utils";

/**
 * Pemeriksaan paling dasar terhadap perkakas, bukan terhadap aturan bisnis.
 *
 * Fondasi menyertakan pipeline pengujian, jadi fondasi juga harus membuktikan
 * pipeline itu benar-benar bisa menjalankan sesuatu. Tanpa satu pun berkas
 * test, `vitest run` berhenti dengan "No test files found" dan pipeline-nya
 * merah pada branch fondasi sendiri.
 */
describe("INF-T01 Perkakas pengujian berjalan dan alias modul terbaca.", () => {
  it("Vitest menjalankan berkas test pada tests/unit", () => {
    expect(true).toBe(true);
  });

  it("Alias @ menunjuk ke src, sehingga import antarmodul bekerja di dalam test", () => {
    expect(typeof cn).toBe("function");
  });

  it("Utilitas cn menggabungkan kelas dan menyelesaikan yang bertabrakan", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
    expect(cn("text-sm", false && "hidden", "font-medium")).toBe(
      "text-sm font-medium",
    );
  });
});
