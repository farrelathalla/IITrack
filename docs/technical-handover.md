# Serah Terima Teknis IITrack

Dokumen ini ditujukan kepada orang yang belum pernah menyentuh repositori ini
dan harus bisa menjalankannya, mengubahnya, lalu menyerahkannya lagi. Isinya
arsitektur, penyiapan, variabel lingkungan, migrasi, pengujian, penanganan
masalah, serta siapa yang bertanggung jawab atas apa.

Sasaran penyiapan: satu pelaksana baru bisa menjalankan IITrack di mesinnya
sendiri dalam waktu kurang dari tiga puluh menit, tanpa bertanya kepada siapa
pun. Bila ternyata lebih lama, yang keliru adalah dokumen ini, bukan pembacanya;
perbaiki bagiannya pada PR yang sama dengan perbaikan yang Anda temukan.

Acuan: `IIT-PRD-IITRACK-DEV-2026` (PRD revisi 24 September 2026, acuan MVP)
dan prototipe Figma Make IITRACK (acuan tampilan). Bila dokumen ini berbeda
dengan PRD, PRD yang berlaku.

## 1. Arsitektur

IITrack adalah satu aplikasi Next.js App Router; backend dan frontend berada di
repositori dan proses yang sama. Tidak ada API terpisah: halaman memanggil
Server Action, dan Server Action memanggil fungsi di `src/server`.

| Lapis | Isi | Boleh mengimpor |
|---|---|---|
| `src/app/` | Halaman, layout, Server Action tipis | `src/lib`, `src/server`, `src/components` |
| `src/components/` | Komponen tampilan | `src/lib`, tipe dari `src/server` |
| `src/server/` | Akses basis data, sesi, mutasi, query, notifikasi, riwayat | `src/lib`, Prisma |
| `src/lib/` | Aturan bisnis murni | tidak Prisma, tidak modul Next.js |

`src/lib` sengaja tidak menyentuh Prisma maupun Next.js supaya aturannya diuji
tanpa menyalakan apa pun. Isinya:

| Berkas | Isi | PRD |
|---|---|---|
| `auth/access.ts` | Matriks hak akses per aksi, visibilitas nominal dan tautan | 2.4 |
| `auth/roles.ts` | Jabatan, divisi, kelompok C-Level, jabatan yang boleh ditugaskan | 2.1-2.2 |
| `project/catalog.ts` | Sembilan stage dan jenis dokumen | 4.1, 4.3 |
| `project/stages.ts` | Status tiap stage dari potret project | 4.1-4.2 |
| `project/status.ts` | Status project, deadline terdekat, next action, penanggung jawab | 8.1, 9 |
| `project/closure.ts` | Closure Checklist, syarat disbursement, Status Final | 4.12, 5.5 |
| `finance/terms.ts` | Validasi skema termin dan alur status per termin | 4.6, 5 |
| `time.ts` | Tanggal WIB; waktu disimpan UTC | 13 |

### Potret project dan status turunan

Status stage, status project, deadline, dan next action **tidak disimpan**.
Server memuat satu `ProjectSnapshot` (`src/server/project/snapshot.ts`), lalu
semua status dihitung dari potret itu oleh `src/lib`. Satu-satunya pengecualian
adalah waktu selesai stage (`project_stages.completedAt`): dicatat permanen
begitu syaratnya pertama kali terpenuhi, supaya penggantian developer atau
Finance POC di kemudian hari tidak mengunci ulang stage sesudahnya.
`syncStageCompletion` mencatatnya, menulis riwayat "Stage n selesai", dan
memberi tahu PM bahwa stage berikutnya terbuka. Stage yang selesai karena waktu
(garansi berakhir) dicatat saat project dibuka.

### Perjalanan satu perubahan

1. Server Action (`src/app/(internal)/projects/[code]/actions.ts`) mengambil
   `Actor` dari sesi dengan `requireActionUser`.
2. Fungsi domain di `src/server/project/*.ts` memanggil `mutateProject`, yang
   memuat potret, memeriksa `canOnProject` (`src/lib/auth/access.ts`), lalu
   menjalankan perubahan di dalam satu transaksi.
3. Perubahan yang wajib dicatat memanggil `recordActivity` di transaksi yang
   sama, dan notifikasi dikirim lewat `notify`/`notifyRoles`.
4. Setelah perubahan, `syncStageCompletion` mencatat stage yang baru selesai.
5. Penolakan dilempar sebagai `ActionError` berpesan Bahasa Indonesia dan
   dikembalikan ke tampilan sebagai `ActionResult`.

Tiga hal yang tidak boleh dilanggar saat menambah fitur:

- **Izin diperiksa di server.** Menyembunyikan tombol tidak memenuhi
  requirement; test integrasi memanggil fungsi server langsung sebagai pengguna
  yang tidak berhak dan mengharapkan penolakan.
- **Tidak ada fitur yang memeriksa izin dengan caranya sendiri.** Semua lewat
  `canOnProject`/`canGlobally` dan daftar aksinya di `src/lib/auth/access.ts`.
- **Data terlarang tidak dikirim ke peramban.** `loadProjectView`
  (`src/server/project/view.ts`) menghapus nominal, tautan MoU, dan tautan
  Kontrak Programmer yang tidak boleh dilihat pengguna itu sebelum dikirim.

### Hak akses

Akses = jabatan × penugasan (PRD bab 1.1). Jabatan menempel pada periode
(`role_assignments` → `periods`), sehingga akses berhenti sendiri pada akhir
periode. Hak edit pada project lahir dari penugasan (`project_assignments`):
PM oleh COO/VCOO, developer oleh CTO/VCTO, Finance POC oleh CFO/VCFO. Penugasan
yang orangnya sudah tidak memegang jabatan yang sesuai (dicabut, periode habis,
atau naik jabatan) tidak lagi memberi hak edit dan membuat project ditandai
"Perlu Penugasan Ulang".

Super Admin adalah jabatan tersendiri. Ia mengelola akun, jabatan, periode, dan
pengaturan, bisa melihat project tanpa nominal, tetapi tidak bisa mengubah data
project, menugaskan orang, atau menyetujui pengajuan.

Keputusan pengajuan mengikuti aturan "keputusan pertama yang berlaku": baris
`submissions` hanya diperbarui selama masih `PENDING`, dan partial unique index
`submissions_single_pending` menjamin satu pengajuan menunggu per dokumen.

### Basis data

PostgreSQL lewat Prisma dengan adapter `@prisma/adapter-pg`. Klien Prisma
dihasilkan ke `src/generated/prisma` dan **tidak di-commit**; bangkitkan ulang
dengan `bun run db:generate` setiap kali clone atau skema berubah.

Aturan yang ditegakkan basis data, bukan disiplin kode:

- **`activity_logs` hanya bisa ditambah.** Trigger `activity_logs_no_update`
  dan `activity_logs_no_delete` menolak UPDATE dan DELETE dari siapa pun.
- **Project ID tidak pernah kembar.** Diterbitkan dari
  `project_number_counters` di transaksi yang sama dengan pembuatan project.
- **Satu PM dan satu Finance POC aktif per project**, dan satu pengajuan
  menunggu per dokumen (partial unique index).
- **Persentase termin 0-100, nominal tidak negatif, target selesai tidak
  sebelum target mulai** (CHECK constraint). Total 100% dicek aplikasi.

## 2. Penyiapan

Prasyarat: [Bun](https://bun.sh) dan PostgreSQL 17 ke atas. Node.js tidak
diperlukan terpisah.

```sh
git clone https://github.com/farrelathalla/IITrack.git
cd IITrack
bun install
cp .env.example .env
```

Pasang PostgreSQL, lalu buat pengguna dan basis datanya. Versi 17 ke atas sudah
diuji; CI memakai 17 dan pengembangan lokal pernah dijalankan di 18.6.

```sh
sudo apt install -y postgresql
```

```sh
sudo -u postgres psql -c "CREATE USER iitrack WITH PASSWORD 'iitrack' CREATEDB;" -c "CREATE DATABASE iitrack OWNER iitrack;" -c "CREATE DATABASE iitrack_test OWNER iitrack;"
```

`.env.example` sudah berisi `DATABASE_URL` dan `TEST_DATABASE_URL` untuk
pengguna dan basis data tersebut. Terapkan skema ke basis data test sekali:

```sh
DATABASE_URL="postgresql://iitrack:iitrack@localhost:5432/iitrack_test" bun run db:deploy
```

Isi juga `SESSION_SECRET` di `.env`:

```sh
openssl rand -base64 32
```

Lalu bangkitkan klien, terapkan skema, isi data contoh, dan jalankan aplikasi:

```sh
bun run db:generate
bun run db:deploy
bun run db:seed
bun run dev
```

Aplikasi berjalan di `http://localhost:3000`. Seed membuat periode 2026/2027,
dua belas akun (daftarnya di README) dengan kata sandi `iitrack-dev-2627`, dan
lima project yang dibangun lewat fungsi server yang sama dengan aplikasi,
sehingga data contoh selalu mematuhi aturan bisnis. Akun ini hanya untuk
pengembangan dan tidak boleh ikut ke lingkungan yang dipakai orang sungguhan.
`bun run db:reset` mengosongkan basis data lokal lalu mengisi ulang seed.

### Kenapa bukan `bunx prisma dev`

Prisma menyediakan `bunx prisma dev` sebagai Postgres sekali jalan, dan untuk
menjalankan aplikasinya saja perintah itu cukup. Untuk test, tidak.

`prisma dev` menjalankan PGlite, yaitu Postgres yang dikompilasi ke WebAssembly,
dan servernya mati begitu menerima `RAISE EXCEPTION` dari trigger. Repositori ini
memakai trigger semacam itu, misalnya penolakan UPDATE/DELETE pada
`activity_logs`. Test append-only sengaja memicunya, servernya tumbang, dan
seluruh berkas test sesudahnya gagal dengan pesan `Can't reach database server`.

Gejalanya menyesatkan karena terlihat seperti kode yang rusak. Yang rusak adalah
basis datanya. Suite yang sama lulus utuh di PostgreSQL asli, dan CI hijau dengan
`postgres:17`. Menurunkan `connection_limit` tidak menolong, begitu juga
menjalankan Vitest tanpa isolasi.

## 3. Variabel lingkungan

`.env` tidak pernah di-commit; yang di-commit hanya `.env.example` yang berisi
bentuknya. Jangan menuliskan nilai sungguhan di dokumen, issue, PR, maupun chat.

| Variabel | Wajib | Bentuk | Dibaca di | Bila salah |
|---|---|---|---|---|
| `DATABASE_URL` | ya | `postgresql://pengguna:sandi@host:5432/basisdata` | `src/server/db.ts`, `prisma.config.ts`, `tests/support/load-env.ts` | Aplikasi gagal start dengan pesan bahwa `DATABASE_URL` belum diisi |
| `SESSION_SECRET` | ya | teks acak, minimal 32 karakter | `src/server/auth/session.ts` | Permintaan yang menyentuh sesi melempar kesalahan bahwa secret belum diisi atau terlalu pendek |
| `TEST_DATABASE_URL` | tidak | sama dengan `DATABASE_URL` | `tests/support/load-env.ts` | Bila kosong, test integrasi menulis ke `DATABASE_URL` dan data pengembangan ikut bertambah |
| `APP_URL` | tidak | `https://iitrack.contoh.id` | `src/app/(internal)/settings/actions.ts` | Bila kosong, link undangan memakai host dari permintaan; isi bila aplikasi berada di balik proxy yang tidak meneruskan host aslinya |

`SESSION_SECRET` dipakai sebagai kunci HMAC token sesi. Yang disimpan di basis
data adalah hasil HMAC-nya, bukan tokennya, sehingga salinan basis data saja
tidak cukup untuk memakai sesi orang lain. Konsekuensinya: **mengganti
`SESSION_SECRET` membuat seluruh sesi yang sedang berjalan tidak lagi dikenali**
dan semua orang harus masuk ulang. Link undangan yang belum dipakai juga
ikut tidak berlaku karena memakai HMAC yang sama. Ganti hanya bila memang
diniatkan.

Sejak Prisma 7, `.env` tidak lagi dibaca Prisma sendiri. `prisma.config.ts` dan
`tests/support/load-env.ts` yang memuatnya lewat `process.loadEnvFile`, dan
ketiadaan berkas `.env` bukan kesalahan karena di CI variabelnya sudah ada di
environment.

## 4. Migrasi

Migrasi ada di `prisma/migrations`, satu direktori per perubahan, dinamai
`YYYYMMDDHHMMSS_ringkasan_singkat`. Urutannya adalah urutan penerapan, jadi
namanya tidak boleh diubah setelah di-push.

| Keperluan | Perintah |
|---|---|
| Membuat migrasi baru dari perubahan `schema.prisma` | `bun run db:migrate` |
| Menerapkan migrasi yang sudah ada | `bun run db:deploy` |
| Membangkitkan ulang klien Prisma | `bun run db:generate` |
| Mengisi data contoh | `bun run db:seed` |
| Mengosongkan basis data lokal dan mengisi ulang | `bun run db:reset` |

Aturan yang berlaku di repositori ini:

- **Migrasi yang sudah di-push tidak diedit.** Perbaikan ditulis sebagai migrasi
  baru. Mengubah yang lama membuat basis data orang lain dan CI berbeda isi
  tanpa ada yang tahu.
- **SQL yang tidak bisa dinyatakan lewat skema ditulis tangan** di berkas
  migrasinya, misalnya trigger append-only `activity_logs` dan partial unique
  index penugasan. Periksa berkas SQL-nya
  setelah `db:migrate`, jangan diasumsikan Prisma menyusun semuanya.
- **Setiap migrasi diberi komentar alasan** bila keputusannya tidak terbaca dari
  DDL-nya, misalnya kenapa sebuah foreign key memakai `RESTRICT` alih-alih
  `SET NULL`.

Migrasi PRD versi awal diganti satu baseline, `20260926000000_baseline_prd_revised`,
karena PRD revisi mengubah model domain secara menyeluruh dan saat itu belum ada
basis data bersama yang isinya harus dipertahankan. Basis data yang dibuat dari
migrasi lama tidak bisa di-upgrade; kosongkan lalu terapkan baseline
(`bun run db:reset` untuk lokal). Mulai dari baseline ini, aturan di atas
berlaku lagi: perubahan skema ditulis sebagai migrasi baru.

## 5. Pengujian

Dua lapis, dipisah karena ongkos jalannya berbeda.

| Lapis | Letak | Perlu Postgres | Perintah |
|---|---|---|---|
| Unit | `tests/unit/` | tidak | `bun run test` |
| Integrasi | `tests/integration/` | ya | `bun run test:integration` |

Test unit menguji `src/lib` dengan potret project buatan
(`tests/support/factories.ts`): matriks akses, status stage, alur termin,
status project, dan penutupan. Test integrasi memanggil fungsi `src/server`
langsung terhadap Postgres sungguhan, termasuk sebagai pengguna yang tidak
berhak, keputusan bersamaan COO dan Vice COO, regenerasi pengurus, dan trigger
append-only. `tests/support/world.ts` menyediakan satu tim pengurus pada
periode uji baru dan helper untuk membawa project ke stage tertentu.

Judul `describe` menyebut bab PRD yang diuji, misalnya
`PRD 5.2, alur status per termin`, supaya setiap test bisa ditelusuri ke
requirement-nya.

Data uji tidak dibersihkan, karena riwayat aktivitas memang tidak bisa dihapus.
Setiap eksekusi memakai periode dan email unik; arahkan `TEST_DATABASE_URL` ke
basis data terpisah supaya data pengembangan tidak ikut bertambah.

### CI

`.github/workflows/ci.yml` berjalan pada setiap pull request dan pada push ke
`main`. Urutannya: `bun install --frozen-lockfile`, `prisma generate`, lint,
typecheck, test unit, `prisma migrate deploy`, test integrasi. Postgres 17
disediakan sebagai service, dan variabel lingkungannya disuntikkan dari
konfigurasi workflow, bukan dari berkas `.env`.

Tidak ada pull request yang digabung tanpa pipeline hijau dan review dari
pelaksana yang lain.

## 6. Penanganan masalah

| Gejala | Sebab yang paling sering | Tindakan |
|---|---|---|
| `DATABASE_URL belum diisi` saat start | `.env` belum dibuat | Salin `.env.example` ke `.env`, isi `DATABASE_URL` seperti pada bab 2 |
| `SESSION_SECRET belum diisi atau terlalu pendek` | Nilainya kosong atau di bawah 32 karakter | Isi dengan hasil `openssl rand -base64 32` |
| Impor `@/generated/prisma/client` tidak ditemukan | Klien Prisma belum dibangkitkan setelah clone atau ganti branch | `bun run db:generate` |
| Typecheck gagal pada field yang baru ditambahkan ke skema | Klien Prisma masih versi lama | `bun run db:generate` |
| Test integrasi gagal seluruhnya di baris koneksi | Postgres tidak hidup, atau `DATABASE_URL` menunjuk basis data lain | `sudo systemctl start postgresql`, pastikan port 5432 mendengar, lalu `bun run db:deploy` |
| Test integrasi lulus beberapa berkas lalu sisanya `Can't reach database server` | Basis datanya PGlite dari `bunx prisma dev`, bukan Postgres asli | Ikuti bab 2; alasannya ada di "Kenapa bukan `bunx prisma dev`" |
| `UPDATE`/`DELETE` pada `activity_logs` ditolak | Trigger append-only, dan ini memang perilaku yang benar | Jangan cari jalan pintas; perbaiki kodenya agar tidak mengubah riwayat |
| `db:deploy` gagal pada basis data lama | Basis data dibuat dari migrasi sebelum baseline PRD revisi | Kosongkan basis datanya (`bun run db:reset` untuk lokal), lalu terapkan ulang |
| Stage tidak terbuka padahal syaratnya sudah terpenuhi | Waktu selesai stage belum dicatat karena syaratnya berubah karena waktu (misalnya garansi berakhir) | Buka Project Detail; `loadProjectView` mencatatnya saat halaman dimuat |
| Semua orang tiba-tiba diminta masuk ulang | `SESSION_SECRET` berganti | Kembalikan nilai lamanya bila pergantiannya tidak disengaja |
| `SelectField` memberi peringatan hydration mismatch | Nilai awal berbeda antara server dan peramban | Lihat `src/components/ui/select-field.tsx`; kasus ini pernah diperbaiki, jangan diperbaiki ulang dengan cara lain |
| Migrasi bentrok setelah rebase | Dua migrasi dibuat paralel di dua branch | Rename migrasi yang belum di-push agar stempel waktunya berurutan, jangan mengedit yang sudah di-push |

## 7. Kepemilikan dan eskalasi

Pembangunan dikerjakan dua pelaksana TechDev. Pembagiannya membelah backend dan
frontend, tetapi keduanya me-review pekerjaan yang lain; tidak ada PR yang
digabung tanpa review silang.

| Urusan | Ditujukan kepada |
|---|---|
| Arsitektur, tech stack, keputusan teknis, penetapan pelaksana TechDev | CTO / Vice CTO |
| Lingkup, prioritas, jadwal, penugasan PM | COO / Vice COO dan Project Manager IITrack |
| Aturan Finance, rantai persetujuan, ambang nilai | CFO / Vice CFO |
| Akun, jabatan, dan periode aktif | Super Admin |

Papan kerja, backlog, dan seluruh issue ada di repositori workspace
`Operational-IIT-Workspace/IITrack`; kodenya di `farrelathalla/IITrack`. Issue
berawalan `DEP` adalah hal yang harus diputuskan stakeholder dan bukan pekerjaan
teknis. Selama sebuah `DEP` masih terbuka, pekerjaan yang bergantung padanya
tidak dianggap tertahan oleh pelaksana, melainkan menunggu keputusan; sebutkan
nomor issue-nya saat melaporkan.

Keputusan berikut diambil saat PRD tidak menyebutnya secara eksplisit. Semuanya
tertulis di kode beserta alasannya; bila stakeholder memutuskan berbeda, yang
berubah cukup satu berkas di `src/lib` atau `src/server` beserta testnya.

- **Stage yang sudah selesai tidak terkunci ulang.** Waktu selesai dicatat
  permanen (`project_stages.completedAt`), supaya mengganti developer di Stage
  6 tidak mengunci Stage 5-9. Lihat `src/lib/project/stages.ts`.
- **Super Admin melihat semua project** di Dashboard dan daftar, read-only
  tanpa nominal. PRD bab 8.1 hanya menyebut C-Level dan yang ditugaskan.
  Lihat `seesAllProjects` di `src/lib/auth/access.ts`.
- **Termin pertama adalah DP (Stage 5), termin terakhir adalah termin final
  (Stage 7), sisanya di Stage 6.** Project dengan satu termin tidak punya
  termin final. Lihat `stageOfTerm` di `src/lib/finance/terms.ts`.
- **Dokumen yang sudah disetujui terkunci**, kecuali MoU yang tautannya masih
  diganti PM dengan versi bertanda tangan sebelum Tandai Ditandatangani.
- **Akhir garansi inklusif**: garansi Selesai sehari setelah tanggal akhir (WIB).
- **Toleransi Status Final default 7 hari**, bisa diubah di Pengaturan > System.
- **Approver utama dan delegasi berlaku** (feedback uji 29 Sep 2026). Bila
  dipilih di Pengaturan > Workflow & Approver, hanya merekalah yang bisa
  Setujui/Tolak dan menerima notifikasi; bila dikosongkan, semua pemegang
  jabatan approver boleh. Approver yang jabatannya sudah berakhir diabaikan
  supaya pengajuan tidak tersangkut. Super Admin mengatur semua jenis, C-Level
  hanya jenis divisinya. Untuk Invoice, Finance POC project selalu boleh; yang
  dipilih adalah cadangannya. Lihat `approverGate` di `src/lib/auth/access.ts`
  dan `loadApproverRules` di `src/server/settings.ts`.
- **Role Permissions ditampilkan, tidak diedit.** Matriksnya diturunkan dari
  aturan server supaya halaman dan penegakan tidak bisa berbeda.
- **Akun baru diaktifkan lewat link undangan**, bukan email: Tambah User
  menghasilkan link sekali pakai (berlaku 7 hari, tabel `invitations`, yang
  disimpan hanya HMAC tokennya) yang disalin Super Admin dan dikirim sendiri
  lewat WA/email. Anggota membuat kata sandinya di `/undangan/[token]` lalu
  langsung masuk. Link yang sama dipakai untuk lupa kata sandi. Kata sandi
  awal manual tetap bisa diisi. Foto profil belum dibangun karena IITrack tidak
  menyimpan berkas.
- **Project dihapus secara soft delete** oleh COO/VCOO dengan alasan
  (`projects.deletedAt`). Project hilang dari semua daftar, pencarian, dan
  halaman detail, tetapi baris dan riwayatnya tetap ada karena `activity_logs`
  append-only, dan Project ID-nya tidak dipakai ulang. Detail awal project
  (nama, client, tipe, sumber, target, catatan) bisa diubah PM project atau
  COO/VCOO lewat menu Kelola; setiap perubahan dicatat nilai lama dan barunya.
- **Technical Blocker bisa ditambah sejak Stage 4**, sama dengan Update
  Progress, karena hambatan bisa muncul begitu developer ditugaskan.
- **Stage berstatus "Disetujui, Belum TTD" tidak ditampilkan sebagai selesai.**
  MoU dan Kontrak Programmer yang disetujui masih harus ditandai
  ditandatangani; panel stage menampilkan checklist syarat
  (`stageRequirements` di `src/lib/project/stages.ts`) dan kotak tanda tangan
  yang mencolok.
- **Akhir periode tidak memicu notifikasi terjadwal.** Tidak ada penjadwal di
  MVP; project dengan penugasan ke akun yang sudah tidak aktif langsung tampil
  "Perlu Penugasan Ulang" di Dashboard C-Level dan header project. Notifikasi
  dikirim saat Super Admin mencabut akses atau mengubah jabatan.
