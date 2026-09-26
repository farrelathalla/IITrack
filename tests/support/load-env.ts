import process from "node:process";

// Vitest tidak membaca .env sendiri. Di CI variabelnya sudah ada di
// environment, jadi ketiadaan berkas .env bukan kesalahan.
try {
  process.loadEnvFile(".env");
} catch {
  // Lanjut memakai environment yang sudah tersedia.
}

// Test integrasi menulis project, pengguna, dan riwayat yang tidak bisa
// dihapus. Bila TEST_DATABASE_URL diisi, test memakai basis data itu supaya
// data pengembangan tidak ikut terisi. Harus di-set sebelum klien Prisma
// pertama kali dibuat.
if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}
