# Serah Terima Teknis IITrack

Dokumen ini ditujukan kepada orang yang belum pernah menyentuh repositori ini
dan harus bisa menjalankannya, mengubahnya, lalu menyerahkannya lagi. Isinya
arsitektur, penyiapan, variabel lingkungan, migrasi, pengujian, penanganan
masalah, serta siapa yang bertanggung jawab atas apa.

Sasaran penyiapan: satu pelaksana baru bisa menjalankan IITrack di mesinnya
sendiri dalam waktu kurang dari tiga puluh menit, tanpa bertanya kepada siapa
pun. Bila ternyata lebih lama, yang keliru adalah dokumen ini, bukan pembacanya;
perbaiki bagiannya pada PR yang sama dengan perbaikan yang Anda temukan.

Acuan: `IIT-PRD-IITRACK-2026` (lingkup dan requirement), `IIT-PCH-OPS26/27`
(estimasi dan timeline), `IIT-UAT-OPS26/27` (kriteria penerimaan). Bila dokumen
ini berbeda dengan ketiganya, ketiganya yang berlaku.

## 1. Arsitektur

IITrack adalah satu aplikasi Next.js App Router; backend dan frontend berada di
repositori dan proses yang sama. Tidak ada API terpisah: halaman memanggil
Server Action dan fungsi server langsung.

Kodenya dibagi tiga lapis, dan pembagiannya bukan selera penataan berkas
melainkan syarat pengujian pada PRD bab 3.9.

| Lapis | Isi | Boleh mengimpor |
|---|---|---|
| `src/app/` | Halaman, layout, form, Server Action | `src/lib`, `src/server` |
| `src/server/` | Akses basis data, sesi, penjaga izin, pencatat jejak | `src/lib`, Prisma |
| `src/lib/` | Aturan bisnis murni: izin, rantai approval, skema termin, penomoran | tidak Prisma, tidak modul Next.js |

`src/lib` sengaja tidak boleh menyentuh Prisma maupun Next.js. Aturan izin,
approval, dan gate dipanggil pada setiap request dan diuji puluhan kali sehari,
jadi keduanya harus bisa dijalankan tanpa menyalakan basis data maupun peramban.
Ketika sebuah aturan mulai membutuhkan basis data, yang dipindah adalah
pengambilan datanya ke `src/server`, bukan aturannya ke bawah.

### Perjalanan satu permintaan

1. Halaman atau Server Action memanggil fungsi di `src/server`.
2. Fungsi itu memuat `Actor` dari sesi (`src/server/auth/session.ts`) dan, bila
   aksinya melekat pada sebuah project, menyusun `ProjectContext` lewat
   `projectContextFor` (`src/server/project/context.ts`).
3. `checkPermission` (`src/lib/auth/permissions.ts`) memutuskan boleh atau
   tidak, lalu mengembalikan alasan dalam bahasa pengguna bila ditolak.
4. Bila lolos, perubahan ditulis, dan aksi kritis memanggil `recordAudit`
   (`src/server/audit.ts`).

Tiga hal yang tidak boleh dilanggar saat menambah fitur:

- **Izin diperiksa di server.** Menyembunyikan tombol tidak dianggap memenuhi
  requirement. Permintaan langsung ke server tetap harus ditolak (F03-AC2).
- **Tidak ada fitur yang memeriksa izin dengan caranya sendiri.** Semua lewat
  `checkPermission` dan daftar `Action` di `src/lib/auth/types.ts`.
- **Aksi kritis meninggalkan jejak.** Nama aksinya didaftarkan di
  `src/lib/audit/actions.ts`; test F24-AC2 memindai `src/server` dan gagal bila
  ada konstanta yang tidak pernah dipanggil.

### Hak akses

Izin menempel pada penetapan jabatan beserta masa berlakunya, bukan pada
orangnya, sehingga akses berhenti sendiri ketika kepengurusan berganti. Hak
ubah lahir dari kombinasi jabatan dan penugasan project: seluruh pengurus dapat
melihat informasi inti project, tetapi hanya pelaksana yang ditugaskan di
divisinya yang dapat mengubah. Tidak ada pengaturan izin manual per project.
Matriksnya ada di `src/lib/auth/capabilities.ts`, menyalin Tabel 1 PRD bab 3.5.

System Administrator bukan divisi keempat, melainkan privilege administratif
yang menempel pada penetapan jabatan anggota TechDev tertentu. Pemegangnya
mengurus akun dan jabatan, dan tidak boleh menyetujui pengajuan bisnis,
mengubah data Finance, maupun menghapus jejak aktivitas.

### Basis data

PostgreSQL lewat Prisma, dengan adapter `@prisma/adapter-pg`. Klien Prisma
dihasilkan ke `src/generated/prisma` dan **tidak ikut di-commit**; harus
dibangkitkan ulang dengan `bun run db:generate` setiap kali repositori baru
di-clone atau skemanya berubah.

Dua aturan ditegakkan basis data, bukan disiplin kode, karena keduanya harus
berlaku juga bagi orang yang mengakses basis datanya langsung:

- **`audit_logs` hanya bisa ditambah.** Trigger `audit_logs_no_update` dan
  `audit_logs_no_delete` menolak UPDATE dan DELETE dari siapa pun. Ini juga
  sebabnya data test tidak dibersihkan dengan menghapus jejaknya.
- **Nomor project tidak pernah kembar.** Penerbitannya berurutan tanpa lompatan
  dan dijaga constraint, termasuk untuk project yang dibatalkan.

## 2. Penyiapan

Prasyarat: [Bun](https://bun.sh) dan akses ke sebuah PostgreSQL. Node.js tidak
diperlukan terpisah. Postgres lokal bisa dijalankan Prisma sendiri, jadi tidak
wajib memasang Postgres di mesin.

```sh
git clone https://github.com/farrelathalla/IITrack.git
cd IITrack
bun install
cp .env.example .env
```

Jalankan Postgres bawaan Prisma, lalu salin `DATABASE_URL` yang dicetaknya ke
`.env`. Perintah ini terus berjalan; biarkan terminalnya terbuka.

```sh
bunx prisma dev
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

Aplikasi berjalan di `http://localhost:3000`. Data contoh berisi lima akun
periode 2026/2027 dengan kata sandi `iitrack-dev-2627`: `coo@iit.test`,
`cfo@iit.test`, `cto@iit.test`, `pm@iit.test`, dan `admin@iit.test` yang
memegang System Administrator privilege. Akun ini hanya untuk pengembangan dan
tidak boleh ikut ke lingkungan mana pun yang dipakai orang sungguhan.

## 3. Variabel lingkungan

Hanya dua, dan keduanya wajib. `.env` tidak pernah di-commit; yang di-commit
hanya `.env.example` yang berisi bentuknya, bukan nilainya. Jangan menuliskan
nilai sungguhan di dokumen, issue, PR, maupun pesan chat.

| Variabel | Wajib | Bentuk | Dibaca di | Bila salah |
|---|---|---|---|---|
| `DATABASE_URL` | ya | `postgresql://pengguna:sandi@host:5432/basisdata` | `src/server/db.ts`, `prisma.config.ts`, `tests/support/load-env.ts` | Aplikasi gagal start dengan pesan bahwa `DATABASE_URL` belum diisi |
| `SESSION_SECRET` | ya | teks acak, minimal 32 karakter | `src/server/auth/session.ts` | Permintaan yang menyentuh sesi melempar kesalahan bahwa secret belum diisi atau terlalu pendek |

`SESSION_SECRET` dipakai sebagai kunci HMAC token sesi. Yang disimpan di basis
data adalah hasil HMAC-nya, bukan tokennya, sehingga salinan basis data saja
tidak cukup untuk memakai sesi orang lain. Konsekuensinya: **mengganti
`SESSION_SECRET` membuat seluruh sesi yang sedang berjalan tidak lagi dikenali**
dan semua orang harus masuk ulang. Ganti hanya bila memang diniatkan.

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

Aturan yang berlaku di repositori ini:

- **Migrasi yang sudah di-push tidak diedit.** Perbaikan ditulis sebagai migrasi
  baru. Mengubah yang lama membuat basis data orang lain dan CI berbeda isi
  tanpa ada yang tahu.
- **SQL yang tidak bisa dinyatakan lewat skema ditulis tangan** di berkas
  migrasinya, misalnya trigger append-only `audit_logs`. Periksa berkas SQL-nya
  setelah `db:migrate`, jangan diasumsikan Prisma menyusun semuanya.
- **Setiap migrasi diberi komentar alasan** bila keputusannya tidak terbaca dari
  DDL-nya, misalnya kenapa sebuah foreign key memakai `RESTRICT` alih-alih
  `SET NULL`.

Skema bertambah per fitur mengikuti pembagian sprint, bukan sekaligus di muka.

## 5. Pengujian

Tiga lapis, dipisah karena ongkos jalannya berbeda.

| Lapis | Letak | Perlu Postgres | Perintah |
|---|---|---|---|
| Unit | `tests/unit/` | tidak | `bun run test` |
| Integrasi | `tests/integration/` | ya | `bun run test:integration` |
| Alur penuh | `tests/e2e/` | ya | `bun run test:integration` |

`bun run test:all` menjalankan keduanya. Test unit tidak menyentuh basis data
maupun peramban, sehingga bisa dijalankan terus-menerus selama menulis kode.
Test integrasi dan alur penuh memakai konfigurasi terpisah
(`vitest.integration.mts`) dan berjalan berurutan, karena berbagi satu basis
data.

Konvensi penamaan:

- Berkas test unit dan integrasi memuat ID fitur dan nomor acceptance criteria,
  misalnya `F03-AC1.test.ts`, dan judul `describe`-nya menyalin kalimat
  acceptance criteria pada PRD bab 4 apa adanya.
- Berkas test alur penuh dinamai mengikuti ID test case UAT, misalnya
  `UAT-E2E-001.test.ts`, sehingga hasil larinya bisa dirujuk langsung dari
  dokumen UAT tanpa penerjemahan.

`tests/support/traceability.ts` memetakan setiap acceptance criteria Must Have
ke test dan test case UAT-nya. Test `XC-01-AC2` membaca judul `describe` dari
berkasnya, bukan dari daftar tulisan tangan, jadi criteria yang testnya dihapus
atau judulnya berubah akan ketahuan. Menambah acceptance criteria di PRD tanpa
menambah testnya akan membuat test itu gagal, bukan lolos diam-diam.

Data uji tidak dibersihkan dengan menghapus jejaknya, karena memang tidak bisa:
larangan hapus ditegakkan trigger basis data. Sebagai gantinya setiap eksekusi
memakai email dan periode yang unik, lihat `tests/support/database.ts`.

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
| `DATABASE_URL belum diisi` saat start | `.env` belum dibuat, atau `bunx prisma dev` belum jalan | Salin `.env.example` ke `.env`, jalankan `bunx prisma dev`, salin URL yang dicetaknya |
| `SESSION_SECRET belum diisi atau terlalu pendek` | Nilainya kosong atau di bawah 32 karakter | Isi dengan hasil `openssl rand -base64 32` |
| Impor `@/generated/prisma/client` tidak ditemukan | Klien Prisma belum dibangkitkan setelah clone atau ganti branch | `bun run db:generate` |
| Typecheck gagal pada field yang baru ditambahkan ke skema | Klien Prisma masih versi lama | `bun run db:generate` |
| Test integrasi gagal seluruhnya di baris koneksi | Postgres tidak hidup, atau `DATABASE_URL` menunjuk basis data lain | Pastikan `bunx prisma dev` berjalan, lalu `bun run db:deploy` |
| Test integrasi gagal karena data sisa | Basis data lokal memuat sisa eksekusi lama pada periode tetap | Jalankan ulang; bila menetap, terapkan ulang migrasi pada basis data kosong |
| `UPDATE`/`DELETE` pada `audit_logs` ditolak | Trigger append-only, dan ini memang perilaku yang benar | Jangan cari jalan pintas; perbaiki kodenya agar tidak mengubah jejak |
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
| Akun, jabatan, dan periode aktif | Pemegang System Administrator privilege |

Papan kerja, backlog, dan seluruh issue ada di repositori workspace
`Operational-IIT-Workspace/IITrack`; kodenya di `farrelathalla/IITrack`. Issue
berawalan `DEP` adalah hal yang harus diputuskan stakeholder dan bukan pekerjaan
teknis. Selama sebuah `DEP` masih terbuka, pekerjaan yang bergantung padanya
tidak dianggap tertahan oleh pelaksana, melainkan menunggu keputusan; sebutkan
nomor issue-nya saat melaporkan.

Dua hal yang saat ini ditulis sebagai penafsiran dan masih menunggu konfirmasi
tertulis, keduanya sudah diberi komentar di kodenya:

- Langkah kedua rantai persetujuan invoice, "POC dokumentasi", dipetakan ke
  Officer Operational karena PRD bab 3.3 tidak memetakannya ke jabatan mana pun
  pada Tabel 1. Lihat `src/lib/approval/chain.ts`.
- Pengelolaan data client diberikan sebagai kewenangan global Officer
  Operational, bukan sesuai penugasan, karena client adalah master data lintas
  project. Lihat `src/lib/auth/capabilities.ts`.

Bila salah satunya diputuskan berbeda, yang berubah cukup satu berkas di
`src/lib` beserta testnya.
