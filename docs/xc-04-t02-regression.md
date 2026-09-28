# XC-04-T02 — Regresi izin, validasi, dan keadaan browser

Bukti eksekusi untuk issue #92 (Dev B). Dijalankan pada `main` @ `5d8f433`,
PostgreSQL lokal Docker, 10 September 2026.

## 1. Suite otomatis

| Pemeriksaan | Perintah | Hasil |
|---|---|---|
| Unit | `bun run test` | 47 berkas, **365 lulus**, 2 todo, 0 gagal |
| Integrasi + e2e | `bun run test:integration` | 27 berkas, **245 lulus**, 0 gagal |
| F03 izin / tampilan | `tests/unit/F03-*.test.ts` | 30 lulus |
| F08 hub + schemeValue | `tests/integration/F08-AC1.test.ts` | termasuk regresi Officer Operational vs `schemeValue` — lulus |

## 2. Retest defect izin (setelah PR #43)

| ID | Kasus | Hasil |
|---|---|---|
| DEF-02 | Officer Operational ditugaskan tidak menerima nilai project lewat `value` / `schemeValue` | **PASS** (live + test F08-AC1) |
| DEF-03 | TechDev Member biasa tidak bisa membaca daftar pengurus (`listMembersWithRoles` → null / halaman 404) | **PASS** (live + test F03-AC2) |

## 3. Validasi & keadaan browser (cek manual / state)

| Kasus | Hasil |
|---|---|
| Tolak pengajuan tanpa alasan — server menolak, status tetap menunggu | Tercakup suite F17 / UAT-APR |
| URL tanpa izin (`/pengurus` sebagai TechDev, antrean Finance tanpa `finance.view`) | Tercakup F03 + guard halaman (404) |
| Setelah LUNAS, antrean Finance tidak menahan item yang sudah selesai | Tercakup F15 / finance e2e |
| Hydration SelectField (perbaikan sebelumnya) | Tidak muncul regresi baru di suite |

## 4. Catatan

- Peer review GitHub PR bukan pintu DoD Tim; bukti di sini dilampirkan ke issue #92.
- Defect Critical terkait izin (DEF-02, DEF-03) sudah diperbaiki Adnan di PR #43 dan diuji ulang Dev B pada sesi ini.
