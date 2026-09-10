import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Test integrasi dan test alur penuh menyentuh Postgres sungguhan, jadi
 * dipisahkan dari test unit supaya lingkar kerja harian tetap cepat dan tidak
 * menuntut basis data hidup.
 *
 * Berkas pada tests/e2e dinamai mengikuti ID test case UAT, sesuai konvensi
 * kerja di README, sehingga hasil larinya bisa dirujuk langsung dari dokumen
 * UAT tanpa penerjemahan.
 *
 * Lokal: arahkan DATABASE_URL ke PostgreSQL sungguhan, lalu
 * `bun run test:integration`. CI menyediakan Postgres sebagai service.
 *
 * `bunx prisma dev` tidak cukup di sini. Postgres bawaannya berjalan di atas
 * PGlite dan mati begitu kena `RAISE EXCEPTION` dari trigger, padahal beberapa
 * aturan memang ditegakkan trigger. Lihat docs/technical-handover.md.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts", "tests/e2e/**/*.test.ts"],
    setupFiles: ["./tests/support/load-env.ts"],
    // Berbagi satu basis data, jadi berkas test dijalankan berurutan.
    fileParallelism: false,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
