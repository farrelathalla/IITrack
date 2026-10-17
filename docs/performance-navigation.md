# Respons klik stage dan tab project

Optimasi ini hanya mengubah pilihan panel di Project Detail. Data project tetap
berasal dari server yang memeriksa izin dan menyembunyikan data sesuai peran.

Sebelumnya, setiap klik stage atau tab divisi memakai `router.replace`, sehingga
Next.js meminta ulang halaman project beserta snapshot dan riwayatnya. Sekarang
pilihan memakai History API yang terintegrasi dengan `useSearchParams`. URL,
parameter lain, fragment, scroll, reload dan Back/Forward tetap dipertahankan.
Aksi Simpan tetap dikirim ke server dan menyegarkan data sesudah berhasil.

## Pengukuran lokal

Checkout staging berbasis `700547c`, Bun 1.4.0, `bun run dev` dengan Turbopack,
Chrome lokal, viewport 1440×1100, PostgreSQL localhost khusus pengujian.
Masing-masing run mengklik sembilan stage dan tiga tab, diulang tiga kali.
Waktu dihitung di browser dari event klik hingga frame sesudah pilihan berubah;
waktu tunggu otomasi sebelum klik tidak dihitung. Tidak ada mock jaringan.

| 36 klik yang sama | Sebelum | Sesudah |
|---|---:|---:|
| Median | 133,75 ms | 15,85 ms |
| Rentang | 113,5–186,6 ms | 12,4–53,3 ms |
| Request ulang halaman project | 36 | 0 |

Median memakai rata-rata dua sampel tengah dari 36 klik. Median turun sekitar
88% pada konfigurasi lokal ini. Angka ini bukan jaminan
latensi semua perangkat atau jaringan. Biaya kompilasi pertama mode development
masih ada; perubahan ini menghilangkan request server yang berulang saat
mengganti panel, bukan kompilasi pertama atau waktu navigasi antarhalaman.

Snapshot yang sedang terbuka tidak otomatis mengambil perubahan pengguna lain
ketika panel diganti. Reload, membuka ulang halaman, atau aksi Simpan yang
berhasil tetap memuat data terbaru. Izin mutasi selalu diperiksa lagi di server.

## Regresi

Dua tes browser request ulang telah dijalankan sebelum perubahan dan gagal
karena setiap pilihan mengirim request RSC. Setelah perubahan, regresi mencakup:

- Semua stage dan tiga tab menampilkan isi yang sesuai tanpa request halaman.
- Parameter URL lain tetap ada; reload dan Back/Forward memulihkan pilihan.
- Simpan Latest Update menampilkan nilai baru dan tetap ada setelah reload.
- Akun read-only tetap tidak memperoleh tombol edit/keputusan invoice.
- Fragment URL dan posisi scroll tidak hilang saat memilih panel.

CI menambahkan job `browser` dengan PostgreSQL terpisah, seed, build production,
dan tes Playwright. Job `verify` tetap memeriksa lint, tipe, unit dan integrasi.
