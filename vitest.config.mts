import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Aturan izin, gate, dan approval diuji tanpa basis data maupun peramban
    // (PRD bab 3.9), jadi environment default cukup node.
    environment: "node",
    // Test unit tidak menyentuh basis data maupun peramban (PRD bab 3.9),
    // sehingga bisa dijalankan puluhan kali per hari tanpa menyalakan apa pun.
    // Test integrasi punya konfigurasi terpisah karena memerlukan Postgres.
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts"],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
