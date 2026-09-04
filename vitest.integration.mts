import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Test integrasi menyentuh Postgres sungguhan, jadi dipisahkan dari test unit
 * supaya lingkar kerja harian tetap cepat dan tidak menuntut basis data hidup.
 *
 * Lokal: jalankan `bunx prisma dev`, salin DATABASE_URL ke .env, lalu
 * `bun run test:integration`. CI menyediakan Postgres sebagai service.
 */
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
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
