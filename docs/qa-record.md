# Catatan Mutu IITrack

Bukti pengujian untuk issue pembangunan Fase 2. Berkas ini dirujuk sebagai
lampiran bukti pada issue XC-06-T01, XC-07-R01, dan seluruh task yang meminta
"Evidence pengujian dilampirkan".

Seluruh defect di bawah ditemukan pada review internal sebelum UAT dijalankan,
bukan pada UAT. Tidak ada satu pun yang pernah sampai ke pengguna.

## 1. Hasil pengujian otomatis

Dijalankan pada `main`, PostgreSQL 18.6, 10 September 2026.

| Pemeriksaan | Perintah | Hasil |
|---|---|---|
| Lint dan format | `bun run lint` | Bersih, 207 berkas |
| Tipe | `bun run typecheck` | Bersih |
| Unit | `bun run test` | 47 berkas, 365 lulus, 0 gagal |
| Integrasi dan alur penuh | `bun run test:integration` | 27 berkas, 245 lulus, 0 gagal |

Ketertelusuran acceptance criteria ada di `tests/support/traceability.ts`, dan
test `XC-01-AC2` membaca judul `describe` langsung dari berkasnya, sehingga
criteria yang testnya dihapus atau judulnya berubah akan gagal, bukan lolos
diam-diam.

Alur penuh yang berjalan: `UAT-E2E-001` (alur project reguler dari pendaftaran
sampai termin lunas) dan `UAT-E2E-004` (percobaan tanpa wewenang). `UAT-E2E-002`
dan `UAT-E2E-003` bergantung pada F19 dan F10 yang berstatus stretch, jadi
statusnya Not Run, Deferred by Scope sesuai `docs/uat-execution-scope.md`.

## 2. Uji performa

PRD bab 5 menetapkan daftar project tampil di bawah tiga detik pada seratus
project. Diukur pada 337 project, 336 termin, 216 invoice, dan 3.002 baris jejak
aktivitas, yaitu 3,4 kali ambang yang diminta.

| Yang diukur | Hasil |
|---|---|
| Kueri daftar project, `readProjectList` | 4 ms terbaik, 6 ms tengah, 20 ms terburuk dari 7 kali |
| Halaman `/projects`, build produksi | 0,34 s muat pertama, lalu 0,08 sampai 0,11 s |
| Halaman project terberat, build produksi | 0,07 s muat pertama, lalu 0,03 s |
| Halaman `/projects`, mode pengembangan | 3,7 s muat pertama, lalu sekitar 2,0 s |

Ambang tiga detik terpenuhi dengan jarak lebar. Angka mode pengembangan
dicantumkan karena di sanalah pekerjaan sehari-hari terasa, dan angka itu memuat
kompilasi Turbopack yang tidak ada di produksi.

Satu catatan yang bukan defect: `readProjectList` mengambil seluruh baris tanpa
batas dan tanpa halaman. Pada 337 project ongkosnya masih 6 ms, jadi tidak
mendesak. Bila jumlah project kelak jauh melampaui angka itu, batas dan
penomoran halaman perlu ditambahkan sebelum daftarnya melambat.

Cara mengulang: siapkan basis data berisi sekurangnya 100 project, jalankan
`bun run build` lalu `bun run start`, dan ukur waktu muat `/projects`.

## 3. Defect log

Mengikuti templat dokumen UAT bab 9.1. Seluruhnya ditemukan pada review rantai
57 commit sebelum penggabungan ke `main`, dan seluruhnya sudah diperbaiki dan
diuji ulang.

### DEF-01 Sesi yang dicabut membuat seluruh halaman gagal

| | |
|---|---|
| Feature | F02 Login & Session Management |
| UAT Case | UAT-AUTH-007, F02-AC3 |
| Severity | Critical, memblokir proses inti |
| Deskripsi | `inspectSession` menghapus cookie sesi di dalam render Server Component, dan Next melarangnya. |
| Langkah | Masuk sebagai pengguna aktif, lalu nonaktifkan akunnya, lalu buka halaman mana pun. |
| Expected | Dialihkan ke halaman masuk beserta alasannya. |
| Actual | HTTP 500 pada `/beranda`, `/projects`, dan juga `/login`, sehingga penggunanya tidak punya jalan kembali selain menghapus cookie perambannya. |
| Perbaikan | Penghapusan cookie lewat `forgetSessionCookie` yang diam bila konteksnya tidak boleh menulis. Pencabutan sesungguhnya tetap di basis data. |
| Retest | PASS. `/beranda` membalas 307 ke `/login?alasan=akun`, `/login` membalas 200. |

### DEF-02 Nilai project terlihat oleh yang tidak berwenang

| | |
|---|---|
| Feature | F08 Project Hub, F03 Role-Based Access Control |
| UAT Case | UAT-HUB-001, UAT-HUB-002, F08-AC2 |
| Severity | Critical, permission bypass |
| Deskripsi | Nilai project dikirim dua kali, dan salinan keduanya sebagai bahan hitung formulir termin tidak ditapis izin. |
| Langkah | Tugaskan Officer Operational pada sebuah project bernilai, lalu buka halaman project itu sebagai dia. |
| Expected | Nilai project tidak tampil, karena jabatan itu tidak memegang `project.view_value`. |
| Actual | Nilai tampil utuh pada panel termin. |
| Perbaikan | `schemeValue` menyalin `value` yang sudah ditapis, sehingga penapisannya tidak bisa berbeda. |
| Retest | PASS. Nilainya tidak lagi muncul, baik pada tampilan maupun pada muatan halaman. |

### DEF-03 Daftar pengurus dapat dibaca tanpa wewenang

| | |
|---|---|
| Feature | F07 Master Data Member & Role, F03 Role-Based Access Control |
| UAT Case | UAT-RBAC-005, F03-AC2 |
| Severity | Critical, permission bypass |
| Deskripsi | `listMembersWithRoles` tidak menerima actor dan tidak memeriksa izin, sehingga aturan yang menyembunyikan menunya hanya berlaku pada menu. |
| Langkah | Masuk sebagai anggota TechDev biasa, lalu buka `/pengurus` langsung. |
| Expected | Ditolak, karena menu itu memang disembunyikan darinya. |
| Actual | HTTP 200 beserta surel seluruh pengurus dan penanda pemegang System Administrator privilege. |
| Perbaikan | Syarat baca disamakan dengan syarat menunya, dan aturannya dipindah ke `src/lib` supaya bisa diuji tanpa basis data. |
| Retest | PASS. Anggota TechDev biasa menerima 404, pemegang `master_data.view` tetap bisa membaca. |

### DEF-04 Penetapan staffing yang gagal di tengah mengunci permintaannya

| | |
|---|---|
| Feature | F14 Staffing Request |
| UAT Case | UAT-SDM-003 |
| Severity | High |
| Deskripsi | Pengajuan disetujui lebih dulu, sebelum penugasan anggota dijalankan, tanpa transaksi. |
| Langkah | Tetapkan dua anggota sekaligus, salah satunya tidak memenuhi syarat. |
| Expected | Penetapan ditolak utuh, dan percobaan ulang berhasil. |
| Actual | Pengajuan sudah disetujui sementara permintaannya masih SUBMITTED, dan percobaan ulang ditolak selamanya karena pengajuannya bukan PENDING lagi. |
| Perbaikan | Kewenangan CTO diperiksa di muka tanpa mengubah apa pun, dan persetujuannya dipindah ke paling akhir. |
| Retest | PASS. Dua test regresi pada `tests/integration/F14-AC1.test.ts`. |

### DEF-05 Tombol setuju dan tolak bergantung pada nama langkah

| | |
|---|---|
| Feature | F17 Regular Approval Workflow |
| UAT Case | UAT-APR-001 s.d. 004 |
| Severity | Medium |
| Deskripsi | Langkah yang sedang berjalan dicocokkan dari nama yang disalin ke basis data saat pengajuan dibuat, sedangkan rantai di kode bisa berubah namanya. |
| Langkah | Ganti nama sebuah langkah pada rantai persetujuan, lalu buka pengajuan yang terlanjur menunggu di langkah itu. |
| Expected | Tombol keputusan tetap ada bagi yang berwenang. |
| Actual | Tombolnya hilang tanpa penyetujunya tahu sebabnya. Pemetaan langkah kedua ke "POC dokumentasi" memang masih menunggu DEP-02, jadi penggantian nama itu diperkirakan terjadi. |
| Perbaikan | Dicocokkan memakai nomor langkah. |
| Retest | PASS. |

### DEF-06 Toleransi percobaan ulang bergantung pada potongan kalimat

| | |
|---|---|
| Feature | F14 Staffing Request, F25 External References |
| UAT Case | UAT-SDM-003, UAT-SDM-004 |
| Severity | Medium |
| Deskripsi | Penolakan yang boleh diabaikan dikenali dari potongan kalimat yang ditulis untuk pengguna. |
| Langkah | Ubah kalimat penolakan "sudah ditugaskan", lalu ulangi penetapan yang sebagian sudah berhasil. |
| Expected | Percobaan ulang tetap berlanjut. |
| Actual | Percobaan ulang gagal keras, dan itu jalan menuju DEF-04. |
| Perbaikan | Penolakan diberi penanda mesin `ALREADY_ASSIGNED` dan `ALREADY_LINKED`. |
| Retest | PASS. |

### DEF-07 Jumlah baris termin tidak berbatas

| | |
|---|---|
| Feature | F13 Termin Management |
| UAT Case | UAT-TERM-001, UAT-NFR-005 |
| Severity | Medium |
| Deskripsi | Jumlah baris diambil mentah dari permintaan dan seluruhnya dibangun sebelum izin diperiksa. |
| Langkah | Kirim Server Action penyimpanan termin dengan `rowCount` yang sangat besar, dari akun mana pun yang sudah masuk. |
| Expected | Ditolak. |
| Actual | Server membangun seluruh barisnya lebih dulu, sebelum ada yang memeriksa bahwa pengirimnya tidak berhak mengubah project itu. |
| Perbaikan | `MAX_TERMIN_ROWS` ditegakkan di lapisan aturan sekaligus di Server Action. |
| Retest | PASS. Test regresi pada `tests/unit/F13-AC1.test.ts`. |

## 4. Ringkasan defect

| Severity | Jumlah | Status |
|---|---|---|
| Critical | 3 | Diperbaiki dan diuji ulang |
| High | 1 | Diperbaiki dan diuji ulang |
| Medium | 3 | Diperbaiki dan diuji ulang |
| **Total** | **7** | Tidak ada yang masih terbuka |

Klasifikasi mengikuti tabel severity pada dokumen UAT bab 9. DEF-02 dan DEF-03
disebut Critical karena tabel itu menyebut permission bypass secara eksplisit,
meskipun keduanya hanya terbuka bagi pengurus yang sudah punya akun.

Perbaikannya ada pada commit `c8b3f15` untuk DEF-01, DEF-04, DEF-06, dan DEF-07,
serta `d6c6d72` untuk DEF-02, DEF-03, dan DEF-05.
