# Lingkup Eksekusi UAT IITrack

Berkas ini menetapkan test case mana pada IIT-UAT-OPS26/27 yang dijalankan pada
UAT Fase 2, mana yang ditunda, dan mana yang tertahan. Disusun untuk XC-08-T01.

## 1. Aturan yang dipakai

PRD Lampiran B mewajibkan dokumen UAT diselaraskan dengan prioritas final
sebelum pengujian dijalankan. ID fitur dan ID test case tidak diubah, yang
diselaraskan adalah expected execution-nya, supaya fitur Should atau Could yang
ditunda tidak tercatat sebagai defect.

Sumber kebenaran prioritas adalah PRD bab 3.6 Tabel 2, bukan bab 5 dokumen UAT.
Bab 5 itu masih versi 24 Agustus 2026 dan mencatat 99 dari 111 test case sebagai
Must Have, termasuk test case milik fitur yang di PRD final berstatus stretch.
Ada 35 test case yang prioritasnya berbeda antara kedua dokumen; seluruhnya
mengikuti PRD.

Empat status yang dipakai, menyalin tabel pada PRD Lampiran B:

| Prioritas fitur | Status test case | Menggagalkan acceptance? |
|---|---|---|
| Must Have | Run | Ya |
| Should Have, dibangun | Run | Ya, untuk fitur itu sendiri |
| Should Have, ditunda | Not Run, Deferred by Scope | Tidak |
| Could Have, ditunda | Not Run, Deferred by Scope | Tidak |

Tidak ada fitur Should atau Could yang ditarik ke scope Fase 2, jadi seluruh
test case miliknya berstatus Not Run, Deferred by Scope.

## 2. Ringkasan

| Status eksekusi | Jumlah | Arti |
|---|---|---|
| Run | 56 | Wajib dijalankan dan lulus. Bagian dari acceptance MVP. |
| Not Run, Deferred by Scope | 45 | Fitur Should/Could yang tidak ditarik ke Fase 2. Bukan Fail, bukan Blocked, bukan penghalang acceptance. |
| Blocked | 10 | Fitur Must Have, tetapi ada yang menahan. Rinciannya di bab 4. |
| **Total** | **111** | |

## 3. Test case yang dijalankan

| ID | Test case | Fitur | Prioritas PRD |
|---|---|---|---|
| UAT-APR-001 | Approver Ditentukan Otomatis | F17 | Must Have |
| UAT-APR-002 | Approve Request | F17 | Must Have |
| UAT-APR-003 | Reject Request | F17 | Must Have |
| UAT-APR-004 | Unauthorized User Tidak Bisa Approve | F17 | Must Have |
| UAT-ASSIGN-003 | CTO/Vice CTO Meng-assign Member TechDev ke Project | F31 | Must Have |
| UAT-ASSIGN-004 | Cross-Domain Assignment Ditolak | F31 | Must Have |
| UAT-ASSIGN-007 | Non-Assignee Tetap View-Only | F31 | Must Have |
| UAT-AUTH-005 | Login dengan Kredensial Valid | F02 | Must Have |
| UAT-AUTH-006 | Login dengan Password Salah | F02 | Must Have |
| UAT-AUTH-007 | Logout dan Session Termination | F02 | Must Have |
| UAT-CLIENT-001 | Tambah Master Data Client | F06 | Must Have |
| UAT-DATA-001 | Data Inti Project Konsisten | F25 | Must Have |
| UAT-DATA-002 | Referensi Data dari Tool Existing | F25 | Must Have |
| UAT-E2E-001 | Regular Project Flow | lintas | Must Have |
| UAT-E2E-004 | Unauthorized User Scenario | F31 | Must Have |
| UAT-FIN-001 | Finance Melihat Semua Request | F15 | Must Have |
| UAT-FIN-002 | Mengetahui Request Menunggu Siapa | F15 | Must Have |
| UAT-HIST-001 | Create Project Masuk History | F24 | Must Have |
| UAT-HIST-002 | Edit Data Masuk History | F24 | Must Have |
| UAT-HIST-003 | Approval Masuk History | F24 | Must Have |
| UAT-HIST-004 | Rejection Masuk History | F24 | Must Have |
| UAT-HIST-005 | History Tidak Bisa Dihapus User Biasa | F24 | Must Have |
| UAT-HUB-001 | Melihat Daftar Project | F08 | Must Have |
| UAT-HUB-002 | Membuka Detail Project | F08 | Must Have |
| UAT-HUB-003 | Membuka Link Tool Existing | F25 | Must Have |
| UAT-INV-001 | PM Mengajukan Invoice | F16 | Must Have |
| UAT-INV-002 | Termin Sama Tidak Dapat Diajukan Dua Kali | F16 | Must Have |
| UAT-NFR-001 | User Baru Melakukan Registrasi Project Tanpa Pendampingan | F05 | Must Have |
| UAT-NFR-002 | User Baru Mengajukan Invoice | F16 | Must Have |
| UAT-NFR-003 | Semua Aksi Kritis Memiliki Audit Trail | F24 | Must Have |
| UAT-NFR-004 | Waktu Muat Daftar Project | F08 | Must Have |
| UAT-NFR-005 | Permission Enforcement untuk Semua Role | F03 | Must Have |
| UAT-NFR-006 | Project ID Protected dan Tidak Didaur Ulang | F05 | Must Have |
| UAT-NFR-007 | Receipt dan Invoice Konsisten | F20 | Must Have |
| UAT-PRJ-001 | Registrasi Project Baru | F05 | Must Have |
| UAT-PRJ-002 | Mandatory Field Tidak Lengkap | F05 | Must Have |
| UAT-PRJ-003 | Project ID Tidak Duplikat | F05 | Must Have |
| UAT-PRJ-004 | Generate/Rekomendasi Project ID Otomatis | F05 | Must Have |
| UAT-RBAC-001 | PM Non-Assignee Dapat View tetapi Tidak Dapat Edit Project | F03 | Must Have |
| UAT-RBAC-002 | PM Tidak Dapat Final Finance Approval | F03 | Must Have |
| UAT-RBAC-003 | CFO Dapat Final Finance Approval | F03 | Must Have |
| UAT-RBAC-004 | CTO/Vice CTO Dapat Menetapkan SDM | F03 | Must Have |
| UAT-RBAC-005 | Authorized TechDev Mengelola User dan Role | F03 | Must Have |
| UAT-RBAC-006 | Edit Project Berdasarkan Assignment Otomatis | F03 | Must Have |
| UAT-RCP-001 | Upload Bukti Transfer | F20 | Must Have |
| UAT-RCP-002 | Validasi Nilai Kuitansi terhadap Invoice | F20 | Must Have |
| UAT-RCP-003 | Termin Menjadi Lunas | F20 | Must Have |
| UAT-SDM-001 | PM Membuat Staffing Request | F14 | Must Have |
| UAT-SDM-002 | CTO/Vice CTO Melihat Staffing Request | F14 | Must Have |
| UAT-SDM-003 | Penetapan SDM | F14 | Must Have |
| UAT-SDM-004 | Repository Ditautkan ke Project | F25 | Must Have |
| UAT-TERM-001 | Membuat Termin | F13 | Must Have |
| UAT-TERM-002 | Total Termin Konsisten dengan Nilai Project | F13 | Must Have |
| UAT-TERM-003 | Status Termin Berubah Setelah Pembayaran | F13 | Must Have |
| UAT-USER-001 | Menambahkan Member dan Role | F07 | Must Have |
| UAT-USER-002 | Role Memiliki Periode Aktif | F07 | Must Have |

## 4. Test case yang tertahan

| ID | Test case | Fitur | Sebab |
|---|---|---|---|
| UAT-ASSIGN-001 | COO/Vice COO Meng-assign PM ke Project | F31 | Proses server sudah ada, layarnya belum dibangun. |
| UAT-ASSIGN-002 | Finance Authority Meng-assign Finance POC ke Project | F31 | Proses server sudah ada, layarnya belum dibangun. |
| UAT-ASSIGN-005 | Reassignment Mengubah Hak Edit Otomatis | F31 | Proses server sudah ada, layarnya belum dibangun. |
| UAT-ASSIGN-006 | Satu Project Memiliki Assignment Lintas Tiga Divisi | F31 | Proses server sudah ada, layarnya belum dibangun. |
| UAT-CLIENT-002 | Update Master Data Client | F06 | Proses server sudah ada, layarnya belum dibangun. |
| UAT-OP-001 | COO Menugaskan Project kepada PM | F04 | Proses server sudah ada, layarnya belum dibangun. |
| UAT-PRJ-005 | Override Project ID oleh COO/Vice COO | F05 | Proses server sudah ada, layarnya belum dibangun. |
| UAT-PRJ-006 | PM Tidak Dapat Override Project ID | F05 | Proses server sudah ada, layarnya belum dibangun. |
| UAT-STAGE-001 | Update Status oleh User Berwenang | F09 | Menunggu DEP-04. |
| UAT-STAGE-002 | Unauthorized Stage Change Ditolak | F09 | Menunggu DEP-04. |

## 5. Test case yang ditunda karena scope

| ID | Test case | Fitur | Prioritas PRD | Prioritas di dokumen UAT |
|---|---|---|---|---|
| UAT-ARCH-001 | Archive Project | F29 | Should Have | Should Have |
| UAT-ARCH-002 | Membuka Project Lama | F29 | Should Have | Should Have |
| UAT-AUTH-001 | Authorized TechDev Mengundang User Baru | F01 | Should Have | Must Have ⚠ |
| UAT-AUTH-002 | User Mengaktifkan Akun dari Invitation | F01 | Should Have | Must Have ⚠ |
| UAT-AUTH-003 | Self Registration Tidak Diizinkan | F01 | Should Have | Must Have ⚠ |
| UAT-AUTH-004 | Invitation Expired atau Tidak Valid | F01 | Should Have | Must Have ⚠ |
| UAT-CHANGE-001 | Perubahan Data Penting Memicu Approval | F23 | Could Have | Must Have ⚠ |
| UAT-DASH-001 | Dashboard Project | F27 | Should Have | Should Have |
| UAT-DASH-002 | Dashboard Sesuai Akses | F27 | Should Have | Should Have |
| UAT-DELEG-001 | Delegasi Approver Sementara | F18 | Should Have | Must Have ⚠ |
| UAT-DELEG-002 | Delegasi Expired | F18 | Should Have | Must Have ⚠ |
| UAT-DISB-001 | Pengajuan Disbursement | F21 | Should Have | Must Have ⚠ |
| UAT-DISB-002 | Approval Disbursement | F21 | Should Have | Must Have ⚠ |
| UAT-DOC-001 | Melihat Status Dokumen Project | F11 | Should Have | Must Have ⚠ |
| UAT-DOC-002 | Kelengkapan Dokumen Terpantau | F11 | Should Have | Must Have ⚠ |
| UAT-DOC-003 | Generate Project Charter | F12 | Should Have | Must Have ⚠ |
| UAT-DOC-004 | Generate MoU | F12 | Should Have | Must Have ⚠ |
| UAT-DOC-005 | Generate Invoice | F12 | Should Have | Must Have ⚠ |
| UAT-DOC-006 | Generate Kuitansi | F12 | Should Have | Must Have ⚠ |
| UAT-DOC-007 | Generate Kontrak Programmer | F12 | Should Have | Must Have ⚠ |
| UAT-DOC-008 | Generate BAST | F12 | Should Have | Must Have ⚠ |
| UAT-E2E-002 | Priority Zero Flow | F19 | Should Have | Must Have ⚠ |
| UAT-E2E-003 | Gate Failure Scenario | F10 | Should Have | Must Have ⚠ |
| UAT-GATE-001 | Hard Stop Mencegah Stage Berlanjut | F10 | Should Have | Must Have ⚠ |
| UAT-GATE-002 | Hard Stop Dilepas Setelah Requirement Lengkap | F10 | Should Have | Must Have ⚠ |
| UAT-GATE-003 | Soft Block Menampilkan Warning | F10 | Should Have | Must Have ⚠ |
| UAT-GATE-004 | Override Wajib Memiliki Alasan | F10 | Should Have | Must Have ⚠ |
| UAT-GATE-005 | Audit Data Override Lengkap | F10 | Should Have | Must Have ⚠ |
| UAT-GATE-006 | Conditional Block pada Perubahan Penting | F23 | Could Have | Must Have ⚠ |
| UAT-HAND-001 | Role Lama Berakhir | F30 | Should Have | Must Have ⚠ |
| UAT-HAND-002 | Authorized TechDev Override Role Period | F30 | Should Have | Must Have ⚠ |
| UAT-HAND-003 | Pengurus Lama Tidak Memiliki Akses Setelah Dicabut | F30 | Should Have | Must Have ⚠ |
| UAT-P0-001 | Pengajuan Priority Zero | F19 | Should Have | Must Have ⚠ |
| UAT-P0-002 | Persetujuan untuk Menandai Priority Zero | F19 | Should Have | Must Have ⚠ |
| UAT-P0-003 | Routing Langsung ke Final Approver | F19 | Should Have | Must Have ⚠ |
| UAT-P0-004 | Audit Trail Priority Zero | F19 | Should Have | Must Have ⚠ |
| UAT-REIM-001 | Pengajuan Reimbursement | F22 | Should Have | Must Have ⚠ |
| UAT-REIM-002 | Reimbursement Tanpa Bukti Ditolak | F22 | Should Have | Must Have ⚠ |
| UAT-SEARCH-001 | Search Berdasarkan Project ID | F28 | Could Have | Could Have |
| UAT-SEARCH-002 | Search Berdasarkan Client | F28 | Could Have | Could Have |
| UAT-SEARCH-003 | Filter PM | F28 | Could Have | Could Have |
| UAT-SEARCH-004 | Filter Status/Stage | F28 | Could Have | Could Have |
| UAT-SEARCH-005 | Combined Filter | F28 | Could Have | Could Have |
| UAT-SUM-001 | Ringkasan Keuangan Project | F26 | Should Have | Should Have |
| UAT-SUM-002 | Nilai Summary Mengikuti Termin | F26 | Should Have | Should Have |

## 6. Akun uji

Dijalankan dengan `bun run db:seed`. Kata sandi seluruh akun `iitrack-dev-2627`.
Daftarnya mengikuti aktor pada test case yang dijalankan, termasuk jabatan yang
butuh dua orang sekaligus.

| Email | Jabatan | Dipakai terutama oleh |
|---|---|---|
| `coo@iit.test` | COO | UAT-OP-001, UAT-PRJ-005, UAT-ASSIGN-001 |
| `vcoo@iit.test` | Vice COO | UAT-ASSIGN-001, UAT-ASSIGN-004 |
| `cfo@iit.test` | CFO | UAT-RBAC-003, UAT-APR-003 |
| `vcfo@iit.test` | Vice CFO | UAT-RBAC-003 |
| `cto@iit.test` | CTO | UAT-RBAC-004, UAT-SDM-003 |
| `vcto@iit.test` | Vice CTO | UAT-RBAC-004, UAT-ASSIGN-003 |
| `pm@iit.test` | Project Manager | pihak yang ditugaskan pada UAT-RBAC-001 dan UAT-ASSIGN-007 |
| `pm2@iit.test` | Project Manager | pihak yang tidak ditugaskan pada dua test case yang sama |
| `officer@iit.test` | Officer Operational | langkah kedua rantai persetujuan, UAT-APR-001 s.d. 004 |
| `poc@iit.test` | Finance POC | UAT-FIN-001, UAT-RCP-001 s.d. 003 |
| `poc2@iit.test` | Finance POC | UAT-ASSIGN-002, sebagai POC yang bukan penugasannya |
| `dev@iit.test` | TechDev Member | UAT-SDM-003, UAT-ASSIGN-003 |
| `dev2@iit.test` | TechDev Member | UAT-ASSIGN-005, sebagai pengganti penugasan |
| `admin@iit.test` | TechDev Member, System Administrator privilege | UAT-AUTH-001, UAT-RBAC-005, UAT-USER-001 dan 002 |

Sebelum UAT dijalankan, ganti kata sandi seluruh akun di lingkungan UAT. Kata
sandi di atas hanya untuk pengembangan lokal.

## 7. Folder bukti

Bukti yang berupa berkas biner, misalnya tangkapan layar dan rekaman, disimpan
di folder Drive project, bukan di repositori. Struktur folder yang dipakai:

```
IITrack UAT 2026/
├─ 01-hasil/            Lembar hasil per test case, satu berkas per kelompok
├─ 02-bukti/            Tangkapan layar, dinamai <ID test case>-<langkah>.png
├─ 03-defect/           Defect log memakai templat UAT bab 9.1
└─ 04-penutup/          Berita acara UAT Sign-Off dan lampirannya
```

Bukti yang berupa keluaran otomatis, yaitu hasil `bun run test:all`, disimpan
bersama lembar hasilnya di `01-hasil` sebagai berkas teks, karena angka lulus
dan gagalnya menjadi bagian dari bukti penerimaan.

## 8. Yang masih menunggu keputusan stakeholder

| Dependency | Isi | Akibat bila belum turun |
|---|---|---|
| DEP-02 | Role-Permission Matrix Finance dan TechDev | Pemetaan langkah kedua rantai persetujuan ke Officer Operational masih penafsiran. Bila keputusannya berbeda, UAT-APR-001 s.d. 004 diselaraskan ulang. |
| DEP-04 | Daftar sebelas tahap resmi | UAT-STAGE-001 dan 002 tertahan. Katalog tahap baru memuat tahap pertama dan terakhir. |
| DEP-05 | Environment UAT dari DevOps IIT | UAT belum bisa dijadwalkan. Seluruh test case menunggu tempat dijalankan. |
| DEP-06 | Peserta, jadwal, pengambil keputusan, dan penanda tangan BAST | Pelaksanaan dan penutupan UAT belum bisa ditetapkan. |

Delapan test case lain tertahan bukan oleh stakeholder, melainkan karena proses
servernya sudah ada tetapi layarnya belum dibangun. Rinciannya di bab 4.
