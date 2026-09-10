import path from "node:path";
import process from "node:process";
import { defineConfig, env } from "prisma/config";

// Prisma 7 tidak lagi membaca .env sendiri. Di CI variabelnya sudah disuntikkan
// lewat environment, jadi ketiadaan berkas .env bukan kesalahan.
try {
  process.loadEnvFile(".env");
} catch {
  // .env tidak ada; lanjut memakai environment yang sudah tersedia.
}

// Sejak Prisma 7, URL koneksi tidak lagi ditulis di schema.prisma.
export default defineConfig({
  schema: path.join("prisma", "schema.prisma"),
  migrations: {
    path: path.join("prisma", "migrations"),
    seed: "bun run prisma/seed.ts",
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});
