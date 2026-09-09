# IITrack

Sistem alur kerja lintas divisi Inkubator IT HMIF ITB. IITrack mencatat project
dari saat COO menugaskan PM sampai project ditutup: satu project punya satu
Project ID, dan seluruh dokumen, termin, pengajuan, serta penugasan menempel
pada nomor tersebut.

Dokumen acuan: `IIT-PRD-IITRACK-2026` (lingkup dan requirement),
`IIT-PCH-OPS26/27` (estimasi dan timeline), `IIT-UAT-OPS26/27` (kriteria
penerimaan).

## Tech stack

Mengikuti template Next.js Inkubator IT, ditambah dua hal yang diminta dokumen
proyek: Prisma karena backend dan frontend berada di satu repositori, dan Vitest
karena aturan izin, gate, dan approval wajib bisa diuji tanpa menjalankan basis
data maupun peramban (PRD bab 3.9).

- **Runtime**: Bun
- **Framework**: Next.js (App Router, Turbopack)
- **Bahasa**: TypeScript
- **UI**: Tailwind CSS v4, shadcn/ui, lucide-react
- **Basis data**: PostgreSQL via Prisma
- **Test**: Vitest
- **Kualitas**: Biome

## Menjalankan secara lokal

```sh
bun install
cp .env.example .env
```

Untuk basis data lokal, jalankan instance Postgres bawaan Prisma lalu salin URL
yang dicetaknya ke `DATABASE_URL`:

```sh
bunx prisma dev
```

Perintah itu mencetak `DATABASE_URL`; salin ke `.env`. Lalu bangkitkan klien
Prisma, terapkan skema, isi data contoh, dan jalankan aplikasi:

```sh
bun run db:generate
bun run db:deploy
bun run db:seed
bun run dev
```

Data contoh berisi lima akun untuk periode 2026/2027 dengan kata sandi
`iitrack-dev-2627`: `coo@iit.test`, `cfo@iit.test`, `cto@iit.test`,
`pm@iit.test`, dan `admin@iit.test` yang memegang System Administrator
privilege.

Penjelasan arsitektur, variabel lingkungan, aturan migrasi, penanganan masalah,
dan jalur eskalasi ada di [`docs/technical-handover.md`](docs/technical-handover.md).

## Perintah

| Perintah | Kegunaan |
|---|---|
| `bun run dev` | Menjalankan server pengembangan |
| `bun run test` | Menjalankan test unit, tanpa basis data |
| `bun run test:integration` | Menjalankan test integrasi, perlu Postgres hidup |
| `bun run test:all` | Menjalankan keduanya |
| `bun run test:watch` | Menjalankan test unit secara berkelanjutan |
| `bun run typecheck` | Memeriksa tipe tanpa membangun |
| `bun run lint` | Memeriksa lint dan format |
| `bun run db:migrate` | Membuat migrasi baru dari perubahan skema |
| `bun run db:deploy` | Menerapkan migrasi yang sudah ada |
| `bun run db:seed` | Mengisi data contoh untuk pengembangan |

## Struktur

```
docs/                  Serah terima teknis dan rancangan halaman
prisma/schema.prisma   Skema basis data
prisma.config.ts       Konfigurasi Prisma: lokasi skema, migrasi, dan URL
src/app/               Halaman dan route (App Router)
src/lib/               Logika murni tanpa basis data, diuji sebagai unit
src/server/            Kode khusus server: akses basis data, sesi, penjaga izin
tests/unit/            Test aturan bisnis, tanpa basis data dan peramban
tests/integration/     Test yang menyentuh basis data, konfigurasi terpisah
tests/e2e/             Skenario alur penuh, dinamai mengikuti ID test case UAT
```

`src/lib` sengaja tidak boleh mengimpor Prisma maupun modul Next.js. Aturan izin,
gate, dan approval dipanggil setiap request dan diuji puluhan kali per hari, jadi
keduanya harus bisa dijalankan tanpa menyalakan apa pun.

## Konvensi kerja

Mengikuti Development Workflow & Guidelines Inkubator IT dan PRD bab 3.9.

**Branch.** Satu branch untuk satu task. `feature/nama-fitur`,
`fix/nama-masalah`, `refactor/nama-bagian`, `chore/nama-task`. Tidak ada yang
dikerjakan langsung di `main`.

**Commit.** `type: description` dengan type `feat`, `fix`, `refactor`, `docs`,
`test`, `chore`, atau `style`. Satu commit mewakili satu perubahan yang jelas.

**Test.** Test ditulis lebih dulu dan terbukti pernah gagal sebelum kodenya
ditulis. Nama berkas test memuat ID fitur dan nomor acceptance criteria,
misalnya `F03-AC1.test.ts`. Judul test menyalin kalimat acceptance criteria pada
PRD bab 4 apa adanya. Berkas test alur penuh dinamai mengikuti ID test case UAT,
misalnya `UAT-E2E-001`.

**Review.** Tim hanya berdua, jadi review dilakukan silang. Tidak ada pull
request yang digabung tanpa review dari pelaksana yang lain, dan pipeline harus
hijau lebih dulu.

**Izin.** Pemeriksaan izin dilakukan di lapisan server. Menyembunyikan tombol
pada tampilan tidak dianggap memenuhi requirement; permintaan langsung ke server
tetap harus ditolak. Pesan penolakan ditulis dalam bahasa pengguna, bukan kode
kesalahan.

**Jejak aktivitas.** Sejak Sprint 1, setiap aksi kritis wajib memanggil fungsi
pencatat jejak beserta testnya.
