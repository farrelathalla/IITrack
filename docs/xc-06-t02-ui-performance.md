# XC-06-T02 — Regresi UI, usability, performa daftar project

Bukti eksekusi untuk issue #101 (Dev B). Dijalankan pada `main` @ `5d8f433`,
10 September 2026.

## 1. Regresi UI / usability (otomatis)

| Pemeriksaan | Hasil |
|---|---|
| Unit + integrasi penuh | 365 + 245 lulus (lihat juga `docs/xc-04-t02-regression.md`) |
| Alur penuh Must Have | `UAT-E2E-001`, `UAT-E2E-004` ikut di suite integrasi — lulus |
| Defect frontend terbuka | **0** (lihat catatan mutu Adnan; DEF-02/03 diuji ulang PASS) |

## 2. Performa daftar project (PRD bab 5: &lt; 3 detik @ ≥100 project)

Diukur lewat `readProjectList` pada basis data lokal (bukan cold start HTTP).

| Yang diukur | Hasil |
|---|---|
| Jumlah project di DB | 138 (≥ ambang 100) |
| `readProjectList` (PM) | **8,5 ms** |
| Ambang PRD 3 detik | **Lulus** dengan jarak lebar |

Catatan Adnan di branch `docs/qa-record` (337 project, halaman `/projects` 0,08–0,11 s produksi) sejalan: ongkos daftar belum mendekati ambang.

## 3. Pengamatan (bukan defect)

- `readProjectList` belum berpaginasi; pada 138–337 baris masih jauh di bawah 3 detik.
- Form registrasi client masih teks bebas di UI (pemilih master client menyusul F06 bila diperhalus) — tidak menggagalkan AC Must Have yang sudah ditelusuri.
