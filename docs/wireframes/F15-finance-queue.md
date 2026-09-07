# F15 — Wireframe antrean Finance & rincian pengajuan (#76 / F15-T03)

Dokumen ini **mengunci** tata letak sebelum `#77` menulis halaman antrean dan
sebelum `#85` menulis tombol setuju/tolak.

Sumber: PRD F15 + F17, UAT-FIN-001 / UAT-FIN-002, UAT-APR-001…004, backend
`readFinanceQueue` / `decideSubmission`, Design Brief, dan slot nav F08-T02.

Kontrak mesin: `src/lib/finance/display.ts`.

---

## 1. Keputusan yang tidak boleh digeser di tengah `#77` / `#85`

| Keputusan | Isi |
| --- | --- |
| Antrean lintas project | Satu daftar untuk invoice dan kuitansi yang masih menunggu, tertua di atas. Bukan `readFinanceChain` (itu satu project). |
| Rute antrean | `/finance/antrean` — sudah dipesan F08. |
| Rute rincian | `/finance/pengajuan/[submissionId]` — satu pengajuan, bukan modal di atas tabel. |
| Nav `Antrean Finance` | Tetap `availability: "later"` sampai halaman #77 hidup. Jangan menggeser urutan nav. |
| Izin tampilan | `finance.view`, sama dengan server. Menyembunyikan tautan tidak cukup; URL tanpa izin → 404. |
| Lama menunggu | Menit kerja (F04), bukan hari kalender. Akhir pekan tidak dihitung. |
| Filter | Jenis (invoice / kuitansi) dan status (tiga keadaan menunggu). Keduanya di halaman antrean. |
| Tombol setuju/tolak | Hanya di halaman rincian (#85). Bukan di baris antrean. Penolakan wajib alasan. |
| Jangan dikarang | Priority Zero (F19 Should Have), antrean staffing (F14 punya `/techdev/antrean`), sufiks nomor dokumen (#84), pagination. |

---

## 2. Alur yang dikunci

```text
[nav / beranda, setelah #77]  -->  [/finance/antrean]
                                         |
                                         | klik baris
                                         v
                               [/finance/pengajuan/{submissionId}]
                                         |
                         +---------------+---------------+
                         |                               |
                    (lihat saja)              [ Setujui ] / [ Tolak ]
                    PM, Finance               hanya pemegang langkah (#85)
```

Staffing **tidak** lewat halaman ini. Permintaan programmer tetap di
`/techdev/antrean`.

Pengajuan invoice baru tetap dari panel termin hub (F16-T03 / #82), bukan dari
antrean.

---

## 3. Halaman antrean — `/finance/antrean` (UAT-FIN-001, F15-T02)

```text
+----------------------------------------------------------------------------------+
|  <- Beranda                                                                      |
|  Antrean Finance                                                                 |
|  Tertua di atas. Lama menunggu dihitung dalam jam kerja.                         |
+----------------------------------------------------------------------------------+
|  Jenis  [ Semua jenis      |v]    Status  [ Semua status           |v]           |
+----------------------------------------------------------------------------------+
|  Nomor     | Project ID   | Client | Nominal | Jatuh  | Approval | Bayar |       |
|  dokumen   |              |        |         | tempo  |          |       |       |
|            |              |        |         |        | Menunggu | Lama menunggu |
+----------------------------------------------------------------------------------+
|  #02-IIT-… | IIT-2627-004 | HMIF   | 7.5 jt  | 01/10  | PENDING  | BELUM |       |
|            |              |        |         |        | Finance  | 4 jam |  -->  |
|            |              |        |         |        | POC      | kerja |       |
+----------------------------------------------------------------------------------+
|  (kosong) Tidak ada pengajuan yang menunggu.                                     |
+----------------------------------------------------------------------------------+
```

Kolom mengikuti `FINANCE_QUEUE_COLUMNS` (F15-AC1). Baris adalah tautan ke
rincian, bukan tempat memutuskan.

Penyaring:

| Filter | Isi |
| --- | --- |
| Jenis | Semua / Invoice / Kuitansi |
| Status | Semua / Menunggu persetujuan / Menunggu pembayaran / Menunggu verifikasi |

Invoice = masih di rantai atau sudah disetujui tetapi belum ada bukti transfer.
Kuitansi = bukti transfer sudah tercatat, Finance POC belum menyatakan valid.

---

## 4. Halaman rincian — `/finance/pengajuan/[submissionId]` (UAT-FIN-002, F17)

```text
+----------------------------------------------------------------------------------+
|  <- Antrean Finance                                                              |
|  #02-IIT-2627-004 · Termin 1                                                     |
+----------------------------------------------------------------------------------+
|  DOKUMEN                                                                         |
|  Project ID, client, nominal, jatuh tempo, status approval, status pembayaran    |
+----------------------------------------------------------------------------------+
|  SEDANG MENUNGGU                                                                 |
|  Pemegang: Finance POC                                                           |
|  Masuk: Selasa 1 Sep 2026 09.00  ·  Lama: 4 jam kerja                            |
+----------------------------------------------------------------------------------+
|  RANTAI PERSETUJUAN                                                              |
|  1. Finance POC          [berjalan]                                              |
|  2. POC dokumentasi      [menunggu]                                              |
|  3. CFO atau Vice CFO    [menunggu]                                              |
|  (pengaju tidak memilih rantai ini)                                              |
+----------------------------------------------------------------------------------+
|  KEPUTUSAN                                          hanya bila berwenang (#85)   |
|  [ Setujui ]     [ Tolak ]                                                       |
|  Alasan penolakan *  (wajib jika Tolak)                                          |
+----------------------------------------------------------------------------------+
```

PM yang `finance.view` melihat pemegang, waktu masuk, dan lama menunggu meski
tidak bisa memutuskan. Itu F15-AC2. Tombol keputusan tetap `can()` per langkah;
server `decideSubmission` menolak yang tidak berwenang (F17-AC4).

---

## 5. Yang sengaja tidak ada di rancangan ini

- Radio Regular vs Priority Zero pada form invoice (ASCII PRD wireframe 2).
  F19 belum Must Have; form F16-T03 tidak memuat jalur P0.
- Form unggah bukti transfer (F20-T03 / #87) dan form invoice (F16-T03 / #82).
  Keduanya hidup di hub, bukan di antrean.
- Item nav baru selain slot `finance_queue` yang sudah ada.
