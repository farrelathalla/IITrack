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

- **Package manager dan script runner**: Bun
- **Runtime Next.js**: Node.js (script saat ini mengikuti shebang CLI Next)
- **Framework**: Next.js (App Router, Turbopack), Server Actions
- **Bahasa**: TypeScript
- **UI**: Tailwind CSS v4, lucide-react
- **Basis data**: PostgreSQL via Prisma
- **Test**: Vitest dan Playwright (regresi browser)
- **Kualitas**: Biome

## Menjalankan secara lokal

Jalankan perintah dari root repo `IITrack`. Prasyarat yang sudah diuji: Bun
1.4.0, Node.js 22.18.0, dan PostgreSQL 17. `bun run dev`/`build` menjalankan CLI
Next dengan Node.js; memakai Bun sebagai script runner tidak otomatis mengganti
runtime CLI menjadi Bun. Lihat [perilaku shebang Bun](https://bun.sh/docs/runtime).

```sh
bun install --frozen-lockfile
cp .env.example .env
```

Contoh penyiapan pertama di Ubuntu/Debian: pasang dan nyalakan PostgreSQL,
lalu buat pengguna serta basis data aplikasi dan test. Lewati pembuatan pengguna
atau basis data yang sudah ada:

```sh
sudo apt install -y postgresql
sudo systemctl start postgresql
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

Buka `http://localhost:3000`. Mode `dev` memakai Turbopack dan hot reload;
halaman yang pertama dibuka dapat menunggu kompilasi. Untuk demo atau mengukur
respons aplikasi sesudah build, gunakan mode production di bawah.

Sebelum menjalankan test integrasi, terapkan migrasi ke `TEST_DATABASE_URL`
juga. Untuk URL contoh di `.env.example`:

```sh
DATABASE_URL="postgresql://iitrack:iitrack@localhost:5432/iitrack_test" bun run db:deploy
```

### Build dan menjalankan production secara lokal

Repo memakai `output: "standalone"`. Hentikan server development pada port yang
akan dipakai, lalu buat build dan salin aset yang dibutuhkan server standalone:

```sh
bun run build
cp -r public .next/standalone/
cp -r .next/static .next/standalone/.next/
HOSTNAME=127.0.0.1 PORT=3000 node --env-file=.env .next/standalone/server.js
```

Buka `http://localhost:3000`. Server ini memakai hasil build sehingga tidak
mengompilasi halaman setiap kali pertama dibuka. Jalankan build dan salin ulang
aset setelah kode berubah. Variabel `DATABASE_URL` dan `SESSION_SECRET` dibaca
dari `.env` oleh opsi Node di atas; nilai yang sudah diekspor di shell tetap
berlaku.

Penyalinan `public` dan `.next/static` diperlukan bila aset dilayani oleh server
standalone sendiri. Next tidak menyalinnya otomatis. `bun run start` saat ini
memanggil `next start` dan menghasilkan peringatan karena output standalone;
untuk konfigurasi repo ini gunakan perintah `server.js` di atas. Lihat
[dokumentasi output standalone Next.js](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).

Petunjuk ini untuk menjalankan build secara lokal atau pada server sendiri.
Deployment Vercel memakai integrasi Next.js dari platform. Seed akun contoh
hanya untuk lingkungan pengembangan, bukan data awal production.

Build memeriksa TypeScript. Berkas `.ts`/`.tsx` lokal yang tidak di-commit juga
tercakup oleh `tsconfig.json`; bila error menunjuk skrip percobaan lama, periksa
skrip tersebut atau gunakan checkout bersih. Jangan mematikan pemeriksaan tipe
untuk melewati error.

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
| `bun run dev` | Server pengembangan dengan Turbopack dan hot reload |
| `bun run build` | Build production dengan Turbopack, termasuk pemeriksaan tipe |
| `bun run start` | `next start`; untuk output standalone gunakan `server.js` sesuai petunjuk di atas |
| `bun run test` | Test unit aturan bisnis, tanpa basis data |
| `bun run test:integration` | Test integrasi; memakai `TEST_DATABASE_URL` bila diisi |
| `bun run test:all` | Keduanya |
| `bun run test:ui` | Regresi klik UI dengan Chromium (Playwright) |
| `bun run typecheck` | Pemeriksaan tipe |
| `bun run lint` | Lint dan format (Biome) |
| `bun run db:generate` | Membangkitkan klien Prisma setelah clone atau perubahan skema |
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
`test`, `perf`, `chore`, atau `style`. Scope opsional, misalnya
`perf(project): avoid refetching panels`.

**Test.** Judul `describe` menyebut bab PRD yang diuji, misalnya
`PRD 5.2, alur status per termin`, supaya setiap test bisa ditelusuri ke
requirement-nya.

**Izin.** Pemeriksaan izin dilakukan di server. Menyembunyikan tombol tidak
dianggap memenuhi requirement; permintaan langsung ke server tetap harus
ditolak. Pesan penolakan ditulis dalam Bahasa Indonesia.

**Riwayat.** Setiap perubahan yang wajib dicatat (PRD bab 12) memanggil
`recordActivity` di transaksi yang sama dengan perubahannya.

**Review.** Tidak ada pull request yang digabung tanpa review dari pelaksana
lain dan pipeline yang hijau.

### Regresi browser

`bunx playwright install chromium` memasang browser untuk `bun run test:ui`.
Gunakan basis data browser terpisah yang masih kosong, misalnya
`iitrack_browser`. Akun seed tidak akan dibuat bila database sudah berisi user
dari test integrasi. `TEST_DATABASE_URL` hanya mengarahkan test integrasi;
Playwright dan server aplikasinya memakai `DATABASE_URL`.

Contoh menggunakan pengguna PostgreSQL lokal di atas:

```sh
sudo -u postgres psql -c "CREATE DATABASE iitrack_browser OWNER iitrack;"
DATABASE_URL="postgresql://iitrack:iitrack@localhost:5432/iitrack_browser" bun run db:deploy
DATABASE_URL="postgresql://iitrack:iitrack@localhost:5432/iitrack_browser" bun run db:seed
bunx playwright install chromium
DATABASE_URL="postgresql://iitrack:iitrack@localhost:5432/iitrack_browser" bun run test:ui
```

Test masuk sebagai akun seed, memilih stage/tab, serta menyimpan Latest Update.
Test memeriksa pilihan URL, reload, Back/Forward, hak akses, scroll, dan
memastikan pergantian panel tidak meminta ulang halaman project. Untuk Chrome
yang sudah terpasang, isi `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` dengan lokasi
executable.

Lokal menjalankan `bun run dev` (Turbopack). Job CI `browser` memakai basis data
terpisah, `bun run build`, menyalin aset public/static, lalu menjalankan
`node .next/standalone/server.js` agar regresi memakai output production yang
sama dengan server standalone. Regresi juga memeriksa create project setelah
error nomor manual, submit pertama tanpa interaksi pemulihan, pencegahan
submit ulang sesudah sukses, dan perubahan teknis berturut-turut tanpa reload
manual.
Job `verify` tetap menjalankan lint, typecheck, unit dan integrasi.
