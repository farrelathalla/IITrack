/**
 * Skeleton isi pengaturan. Judul dan menu kiri milik layout pengaturan sehingga
 * tetap tampil; tanpa batas ini, pindah bagian menunggu server selesai dulu
 * sebelum menu dan isinya berganti.
 */
export default function Loading() {
  return (
    <div
      className="fade-in space-y-3 rounded-xl border border-line bg-white p-5 shadow-sm"
      role="status"
      aria-label="Memuat pengaturan"
    >
      <div className="skeleton h-5 w-40" />
      <div className="skeleton h-4 w-72" />
      <div className="space-y-2 pt-2">
        {["a", "b", "c", "d"].map((key) => (
          <div key={key} className="skeleton h-10 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
