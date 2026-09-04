import process from "node:process";

// Vitest tidak membaca .env sendiri. Di CI variabelnya sudah ada di
// environment, jadi ketiadaan berkas .env bukan kesalahan.
try {
  process.loadEnvFile(".env");
} catch {
  // Lanjut memakai environment yang sudah tersedia.
}
