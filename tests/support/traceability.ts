/**
 * Matriks ketertelusuran requirement Must Have (XC-01-T02).
 *
 * Setiap acceptance criteria Must Have pada PRD bab 4 dicatat di sini beserta
 * rujukan test case UAT-nya. Kalimatnya disalin apa adanya, tidak diringkas,
 * karena kalimat inilah yang dipakai sebagai judul describe pada berkas
 * testnya, dan XC-01-AC2.test.ts mencocokkan keduanya.
 *
 * Acceptance criteria yang ditambahkan tanpa test akan membuat test itu gagal,
 * jadi matriks ini tidak bisa tertinggal diam-diam dari PRD.
 */

export interface TracedCriterion {
  /** Penanda seperti F16-AC2, dipakai sebagai awalan judul describe. */
  id: string;
  /** Kalimat acceptance criteria, disalin apa adanya dari PRD bab 4. */
  criterion: string;
  /** Rujukan test case UAT untuk fiturnya, disalin dari PRD bab 4. */
  uat: string;
  /**
   * Alasan sebuah criteria belum punya test otomatis.
   *
   * Kosong berarti testnya wajib ada. Diisi hanya untuk fitur yang memang
   * belum dibangun, supaya yang belum tertutup tetap terlihat dan tidak
   * hilang dari daftar.
   */
  pending?: string;
}

export const TRACEABILITY: readonly TracedCriterion[] = [
  {
    id: "F02-AC1",
    criterion: "Kredensial salah ditolak tanpa membocorkan informasi.",
    uat: "UAT-AUTH-005 s.d. 007",
  },
  {
    id: "F02-AC2",
    criterion:
      "Setelah logout, tombol Back peramban tidak membuka halaman internal.",
    uat: "UAT-AUTH-005 s.d. 007",
  },
  {
    id: "F02-AC3",
    criterion:
      "Sesi berakhir seketika ketika masa jabatan habis atau akun dinonaktifkan.",
    uat: "UAT-AUTH-005 s.d. 007",
  },
  {
    id: "F03-AC1",
    criterion:
      "Setiap permintaan diperiksa terhadap jabatan aktif dan penugasan project di lapisan server.",
    uat: "UAT-RBAC-001 s.d. 006, UAT-NFR-005",
  },
  {
    id: "F03-AC2",
    criterion:
      "Menyembunyikan tombol saja tidak cukup: permintaan langsung ke server tetap ditolak.",
    uat: "UAT-RBAC-001 s.d. 006, UAT-NFR-005",
  },
  {
    id: "F03-AC3",
    criterion:
      "Jabatan yang periodenya lewat tidak memberi kewenangan apa pun.",
    uat: "UAT-RBAC-001 s.d. 006, UAT-NFR-005",
  },
  {
    id: "F31-AC1",
    criterion:
      "C-Level hanya bisa menugaskan staf dari domainnya sendiri, dan pilihan lintas domain ditolak.",
    uat: "UAT-ASSIGN-001 s.d. 007, UAT-E2E-004",
  },
  {
    id: "F31-AC2",
    criterion: "Penugasan langsung memberi hak edit tanpa pengaturan manual.",
    uat: "UAT-ASSIGN-001 s.d. 007, UAT-E2E-004",
  },
  {
    id: "F31-AC3",
    criterion:
      "Pemindahan penugasan memindahkan hak edit tanpa mengubah jabatan global, dan riwayat penugasan lama tidak dihapus.",
    uat: "UAT-ASSIGN-001 s.d. 007, UAT-E2E-004",
  },
  {
    id: "F31-AC4",
    criterion: "Satu project bisa punya pelaksana dari tiga divisi sekaligus.",
    uat: "UAT-ASSIGN-001 s.d. 007, UAT-E2E-004",
  },
  {
    id: "F31-AC5",
    criterion: "Yang bukan pelaksana tetap bisa melihat informasi inti.",
    uat: "UAT-ASSIGN-001 s.d. 007, UAT-E2E-004",
  },
  {
    id: "F05-AC1",
    criterion:
      "Project ID berformat IIT-2627-NNN, berurutan tanpa lompatan, dan tidak pernah didaur ulang termasuk untuk project yang dibatalkan.",
    uat: "UAT-PRJ-001 s.d. 006, UAT-NFR-006",
  },
  {
    id: "F05-AC2",
    criterion:
      "Penyimpanan ditolak kalau field wajib kosong dan nomor belum terbit sampai datanya lengkap.",
    uat: "UAT-PRJ-001 s.d. 006, UAT-NFR-006",
  },
  {
    id: "F05-AC3",
    criterion:
      "COO atau Vice COO bisa menetapkan nomor manual, dan penetapan itu tercatat beserta nilai lama dan barunya.",
    uat: "UAT-PRJ-001 s.d. 006, UAT-NFR-006",
  },
  {
    id: "F05-AC4",
    criterion: "PM tidak bisa melakukannya.",
    uat: "UAT-PRJ-001 s.d. 006, UAT-NFR-006",
  },
  {
    id: "F06-AC1",
    criterion:
      "Client tersimpan sebagai master data dan bisa dipilih saat membuat project.",
    uat: "UAT-CLIENT-001, UAT-CLIENT-002",
  },
  {
    id: "F06-AC2",
    criterion:
      "Perubahannya berlaku pada seluruh project yang merujuknya dan masuk audit log.",
    uat: "UAT-CLIENT-001, UAT-CLIENT-002",
  },
  {
    id: "F07-AC1",
    criterion: "Jabatan hanya berlaku di dalam periodenya.",
    uat: "UAT-USER-001, UAT-USER-002",
  },
  {
    id: "F07-AC2",
    criterion:
      "Authorized TechDev bisa meng-override periode untuk kondisi khusus dengan mengisi alasan, dan override itu tercatat beserta pelaku dan waktunya.",
    uat: "UAT-USER-001, UAT-USER-002",
  },
  {
    id: "F25-AC1",
    criterion:
      "Tautan tersimpan bersama Project ID dan membuka resource project yang benar, tidak tertukar dengan project lain.",
    uat: "UAT-DATA-001, UAT-DATA-002, UAT-HUB-003, UAT-SDM-004",
  },
  {
    id: "F25-AC2",
    criterion: "Repository yang tertaut bisa dibuka dari Project Hub.",
    uat: "UAT-DATA-001, UAT-DATA-002, UAT-HUB-003, UAT-SDM-004",
  },
  {
    id: "F25-AC3",
    criterion:
      "Data inti project tetap konsisten di konteks Operational, Finance, dan TechDev, tanpa salinan master data yang berbeda.",
    uat: "UAT-DATA-001, UAT-DATA-002, UAT-HUB-003, UAT-SDM-004",
  },
  {
    id: "F08-AC1",
    criterion:
      "Daftar project menampilkan Project ID, nama, client, PM, stage, dan waktu perubahan terakhir.",
    uat: "UAT-HUB-001, UAT-HUB-002",
  },
  {
    id: "F08-AC2",
    criterion: "Nilai project hanya muncul kalau jabatan pengguna mengizinkan.",
    uat: "UAT-HUB-001, UAT-HUB-002",
  },
  {
    id: "F08-AC3",
    criterion:
      "Halaman detail menjadi titik akses ke dokumen, termin, Finance, staffing, repository, riwayat, dan pending action sesuai hak akses.",
    uat: "UAT-HUB-001, UAT-HUB-002",
  },
  {
    id: "F09-AC1",
    criterion: "Stage mengikuti sebelas tahap IITBOOK.",
    uat: "UAT-STAGE-001, UAT-STAGE-002",
  },
  {
    id: "F09-AC2",
    criterion:
      "Perubahan stage mencatat status lama, status baru, pelaku, dan waktu.",
    uat: "UAT-STAGE-001, UAT-STAGE-002",
  },
  {
    id: "F09-AC3",
    criterion:
      "Pengguna tanpa wewenang tidak bisa mengubah stage, dan riwayatnya tidak bisa dimanipulasi.",
    uat: "UAT-STAGE-001, UAT-STAGE-002",
  },
  {
    id: "F04-AC1",
    criterion:
      "Sistem menstempel waktu konfirmasi client dan waktu penugasan PM, lalu menghitung selisihnya terhadap ambang enam jam kerja.",
    uat: "UAT-OP-001",
  },
  {
    id: "F04-AC2",
    criterion:
      "Penugasan masuk riwayat dan langsung memberi hak edit Operational kepada PM yang ditunjuk.",
    uat: "UAT-OP-001",
  },
  {
    id: "F13-AC1",
    criterion: "Termin memuat nomor, persentase atau nominal, dan jatuh tempo.",
    uat: "UAT-TERM-001 s.d. 003",
  },
  {
    id: "F13-AC2",
    criterion:
      "Sistem menolak skema yang jumlah persentasenya bukan seratus, dan menolak termin pertama di luar rentang 25 sampai 50 persen.",
    uat: "UAT-TERM-001 s.d. 003",
  },
  {
    id: "F13-AC3",
    criterion:
      "Status termin berubah menjadi lunas setelah proses kuitansi selesai.",
    uat: "UAT-TERM-001 s.d. 003",
  },
  {
    id: "F16-AC1",
    criterion:
      "Project ID, client, dan nilai terisi otomatis, dan field manual tetap bisa dilengkapi.",
    uat: "UAT-INV-001, UAT-INV-002",
  },
  {
    id: "F16-AC2",
    criterion:
      "Pengajuan masuk langkah approval pertama beserta stempel waktunya.",
    uat: "UAT-INV-001, UAT-INV-002",
  },
  {
    id: "F16-AC3",
    criterion:
      "Termin yang sudah punya pengajuan aktif tidak bisa diajukan lagi, dan sistem menjelaskan alasannya.",
    uat: "UAT-INV-001, UAT-INV-002",
  },
  {
    id: "F15-AC1",
    criterion:
      "Antrean menampilkan nomor dokumen, Project ID, client, nominal, jatuh tempo, status approval dan pembayaran, approver yang sedang memegang, serta lama menunggu.",
    uat: "UAT-FIN-001, UAT-FIN-002",
    pending:
      "Antrean Finance (F15) belum dibangun. F15-T01 di-assign kepada Dev B dan belum dikerjakan; lihat Operational-IIT-Workspace/IITrack#75 dan #88.",
  },
  {
    id: "F15-AC2",
    criterion:
      "PM dan Finance sama-sama bisa melihat sebuah pengajuan sedang menunggu siapa dan sejak kapan.",
    uat: "UAT-FIN-001, UAT-FIN-002",
    pending:
      "Antrean Finance (F15) belum dibangun. F15-T01 di-assign kepada Dev B dan belum dikerjakan; lihat Operational-IIT-Workspace/IITrack#75 dan #88.",
  },
  {
    id: "F20-AC1",
    criterion:
      "Bukti transfer yang diunggah PM menempel pada invoice dan Project ID yang benar.",
    uat: "UAT-RCP-001 s.d. 003, UAT-NFR-007",
  },
  {
    id: "F20-AC2",
    criterion:
      "Kuitansi yang nilainya tidak sama dengan invoice rujukannya tidak bisa dinyatakan valid tanpa penyelesaian, dan sistem menampilkan peringatannya.",
    uat: "UAT-RCP-001 s.d. 003, UAT-NFR-007",
  },
  {
    id: "F20-AC3",
    criterion: "Setelah proses selesai, termin berstatus lunas.",
    uat: "UAT-RCP-001 s.d. 003, UAT-NFR-007",
  },
  {
    id: "F17-AC1",
    criterion:
      "Sistem menentukan approver dari jenis pengajuan dan jabatan, jadi pengaju tidak memilihnya sendiri.",
    uat: "UAT-APR-001 s.d. 004",
  },
  {
    id: "F17-AC2",
    criterion:
      "Setiap langkah mencatat approver, keputusan, alasan, dan waktu, lalu meneruskan ke langkah berikutnya.",
    uat: "UAT-APR-001 s.d. 004",
  },
  {
    id: "F17-AC3",
    criterion:
      "Penolakan wajib mengisi alasan, dan pengajuan yang ditolak bisa diperbaiki tanpa kehilangan riwayat.",
    uat: "UAT-APR-001 s.d. 004",
  },
  {
    id: "F17-AC4",
    criterion:
      "Pengguna tanpa wewenang tidak bisa menyetujui, baik lewat tampilan maupun lewat permintaan langsung ke server.",
    uat: "UAT-APR-001 s.d. 004",
  },
  {
    id: "F14-AC1",
    criterion:
      "Pengajuan memuat Project ID, jabatan yang dibutuhkan, jumlah, tanggal dibutuhkan, kebutuhan teknis, dan deliverable.",
    uat: "UAT-SDM-001 s.d. 004",
  },
  {
    id: "F14-AC2",
    criterion:
      "Request masuk antrean TechDev dengan konteks project yang bisa dibaca CTO.",
    uat: "UAT-SDM-001 s.d. 004",
  },
  {
    id: "F14-AC3",
    criterion:
      "Setelah CTO menetapkan anggota, PM melihat status Ditetapkan, dan pelaku serta waktunya tercatat.",
    uat: "UAT-SDM-001 s.d. 004",
  },
  {
    id: "F14-AC4",
    criterion: "Repository project ditautkan pada langkah yang sama.",
    uat: "UAT-SDM-001 s.d. 004",
  },
  {
    id: "F24-AC1",
    criterion:
      "Entri memuat pelaku, aksi, objek, nilai sebelum, nilai sesudah, dan waktu.",
    uat: "UAT-HIST-001 s.d. 005, UAT-NFR-003",
  },
  {
    id: "F24-AC2",
    criterion:
      "Aksi yang dicatat mencakup pembuatan project, override Project ID, perpindahan stage, override gate, persetujuan, penolakan, penandaan P0, dan perubahan jabatan.",
    uat: "UAT-HIST-001 s.d. 005, UAT-NFR-003",
  },
  {
    id: "F24-AC3",
    criterion:
      "Entri tidak bisa diubah maupun dihapus, termasuk oleh pemegang System Administrator privilege.",
    uat: "UAT-HIST-001 s.d. 005, UAT-NFR-003",
  },
];
