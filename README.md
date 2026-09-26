# IITrack

Sistem alur kerja lintas divisi Inkubator IT HMIF ITB. IITrack mencatat dan
mengendalikan satu project dari saat COO membuat project dan menugaskan PM
sampai project ditutup. Satu project punya satu Project ID, dan seluruh tautan
dokumen, status pembayaran, penugasan, serta riwayat menempel pada nomor itu.

Dokumen acuan: **`IIT-PRD-IITRACK-DEV-2026`** (PRD revisi 24 September 2026,
acuan MVP) dan prototipe **Figma Make IITRACK** sebagai acuan tampilan. Bila
kode berbeda dengan PRD, PRD yang berlaku.

Prinsip yang dipegang (PRD bab 1.1):

- **Satu project, satu record.** Tab Project Manager, Technology Dev, dan
  Finance adalah tiga tampilan atas record yang sama.
- **Dokumen hanya tautan.** MoU, Project Charter, kontrak, dan BAST dibuat di
  Google Docs; IITrack menyimpan tautan dan statusnya.
- **Finance hanya status.** Invoice dan kwitansi diproses di sistem Finance;
  IITrack mencatat status per termin.
- **Akses = jabatan × penugasan**, diperiksa di server.
- **Selalu jelaskan kenapa.** Stage terkunci, tombol nonaktif, dan penolakan
  menyebut alasan dan siapa yang harus bertindak.

## Tech stack

- **Runtime**: Bun
- **Framework**: Next.js (App Router, Turbopack), Server Actions
- **Bahasa**: TypeScript
- **UI**: Tailwind CSS v4, lucide-react
- **Basis data**: PostgreSQL via Prisma
- **Test**: Vitest
- **Kualitas**: Biome

## Menjalankan secara lokal

```sh
bun install
cp .env.example .env
```

Pasang PostgreSQL, lalu buat pengguna serta basis data aplikasi dan basis data
test:

```sh
sudo apt install -y postgresql
```

```sh
sudo -u postgres psql -c "CREATE USER iitrack WITH PASSWORD 'iitrack' CREATEDB;" -c "CREATE DATABASE iitrack OWNER iitrack;" -c "CREATE DATABASE iitrack_test OWNER iitrack;"
```

Isi `SESSION_SECRET` di `.env` dengan hasil `openssl rand -base64 32`. Lalu
bangkitkan klien Prisma, terapkan skema, isi data contoh, dan jalankan:

```sh
bun run db:generate
bun run db:deploy
bun run db:seed
bun run dev
```

Buka `http://localhost:3000`.

### Akun contoh

Seed membuat periode 2026/2027 dan lima project yang dibangun lewat alur
sungguhan (satu sudah ditutup, satu di tengah pengembangan, satu MoU ditolak,
satu menunggu persetujuan Project Charter, satu baru dibuat). Semua akun memakai
kata sandi `iitrack-dev-2627`:

| Email | Jabatan |
|---|---|
| `karen@iit.test`, `rizky@iit.test` | Project Manager |
| `ghazy@iit.test` / `keisha@iit.test` | COO / Vice COO |
| `adnan@iit.test` / `budi@iit.test` | CTO / Vice CTO |
| `anice@iit.test`, `rafi@iit.test` | Tech Developer |
| `dinda@iit.test` / `rima@iit.test` | CFO / Vice CFO |
| `evan@iit.test` | Finance POC |
| `admin@iit.test` | Super Admin |

Akun ini hanya untuk pengembangan. `bun run db:reset` mengosongkan basis data
lokal lalu mengisi ulang data contoh.

## Perintah

| Perintah | Kegunaan |
|---|---|
| `bun run dev` | Server pengembangan |
| `bun run test` | Test unit aturan bisnis, tanpa basis data |
| `bun run test:integration` | Test integrasi; memakai `TEST_DATABASE_URL` bila diisi |
| `bun run test:all` | Keduanya |
| `bun run typecheck` | Pemeriksaan tipe |
| `bun run lint` | Lint dan format (Biome) |
| `bun run db:migrate` | Membuat migrasi baru dari perubahan skema |
| `bun run db:deploy` | Menerapkan migrasi |
| `bun run db:seed` | Mengisi data contoh (dilewati bila sudah ada pengguna) |
| `bun run db:reset` | Mengosongkan basis data lokal lalu mengisi ulang data contoh |

## Struktur

```
prisma/schema.prisma       Skema (PRD bab 12)
prisma/seed.ts             Data contoh, dibangun lewat fungsi server
src/lib/                   Aturan bisnis murni, diuji tanpa basis data
  auth/access.ts           Matriks hak akses dan visibilitas (bab 2.4)
  project/stages.ts        Status sembilan stage (bab 4)
  project/status.ts        Status project, deadline, next action (bab 9)
  project/closure.ts       Closure Checklist, disbursement, Status Final
  finance/terms.ts         Skema dan alur status termin (bab 5)
src/server/                Akses basis data, sesi, mutasi, query
  project/mutate.ts        Jalur tunggal perubahan data project
  project/view.ts          Data Project Detail per pengguna (tanpa data terlarang)
src/app/                   Halaman dan Server Action
src/components/            Komponen tampilan
tests/unit/                Test aturan bisnis
tests/integration/         Test terhadap Postgres sungguhan
docs/technical-handover.md Arsitektur, penyiapan, migrasi, penanganan masalah
```

`src/lib` tidak boleh mengimpor Prisma maupun modul Next.js, supaya aturan izin,
stage, dan termin bisa diuji tanpa menyalakan apa pun.

## Konvensi kerja

Mengikuti Development Workflow & Guidelines Inkubator IT.

**Branch.** Satu branch untuk satu task: `feature/…`, `fix/…`, `refactor/…`,
`chore/…`. Tidak ada yang dikerjakan langsung di `main`.

**Commit.** `type: description` dengan type `feat`, `fix`, `refactor`, `docs`,
`test`, `chore`, atau `style`.

**Test.** Judul `describe` menyebut bab PRD yang diuji, misalnya
`PRD 5.2 — alur status per termin`, supaya setiap test bisa ditelusuri ke
requirement-nya.

**Izin.** Pemeriksaan izin dilakukan di server. Menyembunyikan tombol tidak
dianggap memenuhi requirement; permintaan langsung ke server tetap harus
ditolak. Pesan penolakan ditulis dalam Bahasa Indonesia.

**Riwayat.** Setiap perubahan yang wajib dicatat (PRD bab 12) memanggil
`recordActivity` di transaksi yang sama dengan perubahannya.

**Review.** Tidak ada pull request yang digabung tanpa review dari pelaksana
lain dan pipeline yang hijau.
