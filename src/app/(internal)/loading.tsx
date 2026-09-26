/**
 * Skeleton saat halaman internal dimuat. Bentuknya mengikuti tata letak umum
 * (judul, kartu ringkasan, daftar) supaya perpindahan tidak melompat.
 */
export default function Loading() {
  return (
    <div
      className="fade-in mx-auto max-w-[1200px] space-y-5 p-6"
      role="status"
      aria-label="Memuat halaman"
    >
      <div className="space-y-2">
        <div className="skeleton h-6 w-48" />
        <div className="skeleton h-4 w-72" />
      </div>
      <div className="grid grid-cols-4 gap-3">
        {["a", "b", "c", "d"].map((key) => (
          <div key={key} className="skeleton h-24 rounded-xl" />
        ))}
      </div>
      <div className="space-y-3">
        {["a", "b", "c"].map((key) => (
          <div key={key} className="skeleton h-28 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
