# F08 — Wireframe Project Hub & menu utama (#51 / F08-T02)

Dokumen ini **mengunci** tata letak sebelum `#50` menulis halaman sungguhan.
Sumber: PRD bab 3.4.1 (ASCII), F08 AC, UAT-HUB-001…003, Design Brief token,
dan nav yang sudah hidup (F03-T04).

Kontrak mesin (untuk test + implementasi): `src/lib/ui/project-hub-layout.ts`.

---

## 1. Keputusan yang tidak boleh digeser di tengah `#50`

| Keputusan | Isi |
| --- | --- |
| Hub = **satu layar scroll**, bukan tab per modul | Sesuai ASCII PRD; semua section terlihat tanpa pindah route |
| Daftar dan detail dipisah route | `/projects` (daftar) → `/projects/[projectId]` (hub) |
| Nav utama pendek | Beranda · Project · Client · Pengurus · (nanti Antrean Finance) |
| **Daftarkan project** keluar dari nav permanen | Jadi tombol primer di `/projects` bila `project.create` |
| Nilai project | Kolom/field hanya jika `project.view_value` |
| Menu/tombol | Tetap lewat `can()` / `ui-visibility`; server tetap sumber larangan |
| Stage tracker | Tampilkan tahap **yang sudah ada di katalog**; jangan mengarang 9 nama kosong (DEP-04) |

---

## 2. Menu utama (target)

```text
+----------------------------------------------------------------------------------+
| IITrack   Beranda   Project   Client   Pengurus         [nama]  Keluar           |
|           (selalu)  (view)    (master) (master_data|member.manage)               |
|                     ↳ nanti: Antrean Finance (finance.view) setelah F15          |
+----------------------------------------------------------------------------------+
```

### Migrasi dari nav hari ini

| Sekarang | Sesudah wireframe ini |
| --- | --- |
| Beranda | Tetap |
| Daftarkan project (nav) | Pindah jadi CTA di `/projects` |
| Pengurus | Tetap (aturan tampil sama F03-T04) |
| — | **Project** → `/projects` (baru di #50) |
| — | **Client** → `/clients` (F06-T02 / #62) |

Slot **Antrean Finance** sudah dipesan di kontrak supaya Sprint 2 tidak mengacak urutan nav lagi.

---

## 3. Daftar project — `/projects` (UAT-HUB-002)

```text
+----------------------------------------------------------------------------------+
| Project                                                    [ + Daftarkan project ]|
| (tombol hanya jika project.create)                                               |
+----------------------------------------------------------------------------------+
| Project ID     | Nama              | Client    | PM     | Tahap      | Diubah    |
| IIT-2627-004   | Sistem Alur …     | HMIF ITB  | Karen  | Charter*   | 04/09 …   |
| IIT-2627-003   | …                 | …         | …      | …          | …         |
|                |  (kolom Nilai hanya bila project.view_value)                    |
+----------------------------------------------------------------------------------+
| Baris diklik → /projects/IIT-2627-004                                            |
+----------------------------------------------------------------------------------+
```

\*Label tahap memakai katalog F09; selama DEP-04 belum lengkap, tampilkan key/label yang dikenal atau “Belum ditetapkan”.

---

## 4. Hub detail — `/projects/[projectId]` (UAT-HUB-003 / F08-T01)

Urutan section dari atas (lihat juga `HUB_SECTIONS`):

```text
+----------------------------------------------------------------------------------+
| <- Project                                                                       |
|                                                                                  |
| IIT-2627-004 · Sistem Alur Kerja Internal IIT                                    |
| Client: HMIF ITB  ·  Periode: 2627  ·  Status: ACTIVE                            |
| Nilai: Rp 25.000.000          ← sembunyikan bila !project.view_value             |
+----------------------------------------------------------------------------------+
| TAHAP BERJALAN                                                                   |
| [1 Initial Comm] — … — [*tahap sekarang*] — … — [11 Revenue Share …]             |
| Sekarang: …     [ Ajukan perpindahan tahap ]  ← hanya bila stage.change (+ctx)   |
+----------------------------------------------------------------------------------+
| TINDAKAN MENUNGGU (opsional; sembunyikan blok jika kosong)                       |
| · …                                                                              |
+----------------------------------------------------------------------------------+
| TIM & PENUGASAN              |  DOKUMEN & TAUTAN                                 |
| Operational: Karen (PM)      |  Charter   [ada/belum]  [buka tautan]             |
| Finance: …                   |  MoU       …                                      |
| TechDev: …                   |  Repo GitHub  github.com/…                        |
| Repo: [buka]                 |  Drive/Notion …                                   |
+----------------------------------------------------------------------------------+
| TERMIN & PEMBAYARAN          |  RIWAYAT AKTIVITAS                                |
| T1 DP 30%  Rp …  [Lunas]     |  04/09  Karen  pindah tahap …                     |
| T2 …                         |  02/09  Dylan  setujui …                          |
|                              |  (daftar mudah dibaca, bukan dump tabel)          |
+----------------------------------------------------------------------------------+
```

### Zona layout (desktop)

| Baris | Kiri | Kanan |
| --- | --- | --- |
| penuh | Identitas | |
| penuh | Tahap | |
| penuh | Tindakan menunggu | |
| 1 | Tim & penugasan | Dokumen & tautan |
| 2 | Termin & pembayaran | Riwayat aktivitas |

Mobile: stack vertikal mengikuti `order` di kontrak (kiri dulu, lalu kanan per baris).

---

## 5. Komponen shared yang dipakai `#50`

Dari `#54` / Design Brief:

- `Table` — daftar project
- `StatusBadge` + `toneForStatus` — stage, status dokumen, termin
- `Button` — CTA daftar / ajukan tahap
- `Alert` — penolakan izin atau gate (nanti F10)
- `Dialog` — konfirmasi aksi bila perlu

Jangan menambah kartu dekoratif di luar pola yang sudah ada (border `border-line`, `rounded-card` seperti form existing).

---

## 6. Izin (pelengkap UI saja)

| Elemen | Syarat tampil (kira-kira) |
| --- | --- |
| Nav Project | `project.view` |
| Tombol Daftarkan | `project.create` |
| Kolom/field Nilai | `project.view_value` |
| Tombol pindah tahap | `stage.change` + konteks project (server wajib) |
| Blok Finance sensitif | `finance.view` / aksi terkait |
| Nav Pengurus | `master_data.view` ∨ `member.manage` |
| Nav Client | `master_data.view` |
| Form tambah client | `client.manage` (server `createClient`) |

---

## 7. Di luar wireframe ini

- Implementasi React sungguhan → **#50**
- Wireframe form registrasi + termin → **#59** (`docs/wireframes/F05-F13-registration-termin.md`)
- Gate modal Hard Stop → PRD wireframe 3 (F10, Should Have)
- Antrean Finance penuh → F15

---

## 8. Evidence / cara review

1. Baca dokumen ini + `src/lib/ui/project-hub-layout.ts`.
2. Jalankan `bunx --bun vitest run tests/unit/F08-T02.test.ts`.
3. Peer review: setuju susunan section & nav sebelum `#50` coding.
