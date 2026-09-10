# F05 + F13 — Wireframe formulir daftar project & jadwal termin (#59 / F05-T05)

Dokumen ini **mengunci** tata letak sebelum `#74` menulis formulir termin, dan
sebelum form daftar (#57) diganti pemilih client master (F06).

Sumber: PRD F05 + F13, UAT-PRJ-001…006 / UAT-NFR-006 / UAT-TERM-001…002,
backend `registerProject` + `saveTerminScheme`, Design Brief, dan wireframe
hub F08.

Kontrak mesin: `src/lib/ui/registration-termin-layout.ts`.

---

## 1. Keputusan yang tidak boleh digeser di tengah `#74`

| Keputusan | Isi |
| --- | --- |
| Daftar dan termin **bukan satu submit** | Nomor Project ID terbit dulu (F05). Jadwal termin menempel pada project yang sudah ada (F13). |
| Kenapa dipisah | UAT-PRJ-002: data wajib kosong → nomor **belum** terbit. `validateTerminScheme` menolak nilai project kosong. Mencampur keduanya menahan nomor hanya karena DP belum 25%. |
| Registrasi | `/projects/baru` — satu kolom, lebar terbatas (sudah hidup di #57). |
| Termin | Panel **Termin & pembayaran** di hub `/projects/[projectId]` (slot F08). Bukan rute baru. |
| Client | Dipilih dari master data (`clientId`), bukan diketik ulang. |
| Override Project ID | **Bukan** bagian form daftar. COO mengoverride dari hub (F05 AC terpisah). |
| Skema disimpan utuh | Tambah/hapus baris di form, satu tombol simpan. Bukan simpan per baris. |
| Umpan balik langsung | Jumlah % dan rentang DP tampil **sebelum** submit (#74). Server tetap menolak skema salah. |
| Jangan dikarang | UAT-PRJ-001 menyebut jenis/PM/scope/termin di form create. Field itu **tidak** ada di backend F05; jangan ditambah di sini. |

`#57` sudah menampilkan Project ID besar. Wireframe ini mengunci **target**
(pemilih client + pintu ke termin), bukan menyuruh menulis ulang halaman yang
sudah In review.

---

## 2. Alur yang dikunci

```text
[/projects]  --CTA Daftarkan-->  [/projects/baru]
                                      |
                                      | submit lengkap
                                      v
                               Project ID besar
                                      |
          +---------------------------+---------------------------+
          |                           |                           |
   Daftar yang lain            Buka Project Hub         Susun jadwal termin
   /projects/baru              /projects/{id}           /projects/{id}
                                                        (panel termin)
```

Termin **tidak** diisi pada langkah daftar. Setelah nomor terbit, CTA
mengantar ke hub, bukan ke form kedua di `/projects/baru`.

---

## 3. Formulir daftar — `/projects/baru` (UAT-PRJ-001, 002, 004, NFR-006)

```text
+----------------------------------------------------------+
|  <- Project / Daftarkan project                          |
|                                                          |
|  Daftarkan project                                       |
|  Nomor resmi baru terbit setelah isian wajib lengkap.    |
|  Belum lengkap = nomor belum dipakai.                    |
+----------------------------------------------------------+
|  Nama project *           [ ________________________ ]   |
|  Client *                 [ pilih dari master     |v]   |  ← F06
|                           Client belum ada? minta COO /  |
|                           Officer menambahkannya.        |
|  Periode (empat digit) *  [ 2627                     ]   |
|                           Masuk ke IIT-2627-NNN          |
|  Nilai project            [                          ]   |
|                           Opsional sekarang. Wajib       |
|                           sebelum jadwal termin bisa     |
|                           dihitung.                      |
|                                                          |
|                          [ Daftarkan project ]           |
+----------------------------------------------------------+
```

### Setelah nomor terbit (UAT-PRJ-001 / NFR-006)

```text
+----------------------------------------------------------+
|  Project berhasil didaftarkan. Nomor ini tidak didaur    |
|  ulang, termasuk jika project nanti dibatalkan.          |
|                                                          |
|              +----------------------------+              |
|              |      Project ID            |              |
|              |     IIT-2627-004           |              |
|              +----------------------------+              |
|                                                          |
|  [ Susun jadwal termin ]  [ Buka Project Hub ]           |
|  [ Daftarkan project lain ]                              |
+----------------------------------------------------------+
```

"Susun jadwal termin" hanya bila `project.edit_operational` pada project itu
(COO, atau PM yang ditugaskan — PM pendaftar belum otomatis PM assigned).
Kalau belum ditugaskan, cukup **Buka Project Hub**.

Override ID **tidak** muncul di layar ini.

---

## 4. Formulir jadwal termin — panel hub (UAT-TERM-001, 002)

Tempat: section kiri baris 2 wireframe F08 (`termin`). Form mengisi slot yang
sekarang masih placeholder.

```text
+----------------------------------------------------------+
|  TERMIN & PEMBAYARAN                                     |
|  Nilai project: Rp 25.000.000                            |
|                                                          |
|  Jumlah persentase   100.00 / 100     [ lengkap ]        |  ← live
|  Uang muka (termin 1) 30%             [ 25–50%  ]        |  ← live
|                                                          |
|  # | Label (ops.) | % atau Rp      | Jatuh tempo |       |
|  1 | DP           | 30             | 2026-09-15  | [−]   |
|  2 | Progress     | 40             | 2026-11-01  | [−]   |
|  3 | Pelunasan    | 30             | 2027-01-15  | [−]   |
|                                                          |
|  [ + Termin ]                                            |
|                                                          |
|  [ Simpan skema termin ]                                 |
+----------------------------------------------------------+
```

### Aturan tampilan (bukan aturan bisnis baru)

| Keadaan | Tampilan |
| --- | --- |
| Boleh `project.edit_operational` + nilai ada + belum ada yang lunas | Form di atas |
| Nilai project kosong | Alert: isi nilai dulu; tabel/form tidak bisa disimpan |
| Ada baris `PAID` | Daftar baca saja; tombol simpan hilang |
| Tidak berwenang mengubah | Daftar saja (status, %, Rp, jatuh tempo) |
| Jumlah % ≠ 100.00 | Penanda bahaya **sebelum** submit; tombol boleh tetap ada — server yang menolak |
| DP di luar 25–50 | Sama: penanda langsung, server tetap menolak |

Isian per baris: nomor urut (1 = uang muka, tidak diketik bebas — diisi form
saat tambah/hapus), persentase **atau** nominal (yang kosong dihitung dari
nilai project), jatuh tempo wajib, label opsional.

Minimal dua baris: satu termin 100% gagal karena DP harus 25–50.

Jangan mengarang status lunas dari form ini (itu F20 / UAT-TERM-003).

---

## 5. Komponen shared

- `TextField` / `SelectField` / `TextArea` — isian
- `Button` — daftar, tambah baris, simpan skema
- `Alert` / `FieldError` — wajib kosong, % belum 100, DP di luar rentang
- `Table` — daftar termin bila hanya melihat
- `StatusBadge` — UNPAID / PAID (baca saja)

Hitungan % live boleh teks `angka`, bukan library chart.

---

## 6. Izin (pelengkap UI saja)

| Elemen | Syarat tampil |
| --- | --- |
| Halaman `/projects/baru` | `project.create` |
| Pemilih client | `master_data.view` (isi dari `listClients`) |
| CTA Susun termin setelah ID | `project.edit_operational` + konteks project |
| Form termin di hub | `project.edit_operational` + konteks project |
| Daftar termin di hub | `project.view` (sudah di hub) |

Server: `registerProject` / `saveTerminScheme`. Menyembunyikan tombol tidak
menggantikan itu.

---

## 7. Di luar wireframe ini

- Implementasi pemilih client di #57 (masih teks bebas) — follow-up, bukan #59
- Implementasi form termin React → **#74**
- Override Project ID → hub / task F05 override, bukan form daftar
- Status lunas setelah bayar → F20
- Invoice dari baris termin → F16

---

## 8. Evidence / cara review

1. Baca dokumen ini + `src/lib/ui/registration-termin-layout.ts`.
2. Jalankan `bunx --bun vitest run tests/unit/F05-T05.test.ts`.
3. Peer review: setuju pemisahan daftar vs termin, dan umpan balik % live,
   sebelum `#74` coding.
