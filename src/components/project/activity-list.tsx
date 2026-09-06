import type { ActivityItem } from "@/lib/audit/activity";
import { formatDateTimeId } from "@/lib/project/hub-display";

/**
 * Daftar jejak project: kalimat, pelaku, waktu — bukan tabel kolom mentah.
 * Tidak ada kontrol hapus (UAT-HIST-005).
 */
export function ProjectActivityList({ items }: { items: ActivityItem[] }) {
  if (items.length === 0) {
    return (
      <p className="text-slate-500 text-sm">
        Belum ada jejak pada project ini.
      </p>
    );
  }

  return (
    <ol className="flex flex-col gap-3">
      {items.map((item) => (
        <li
          key={`${item.at.toISOString()}-${item.headline}-${item.actorName ?? ""}`}
          className="border-line border-b pb-3 last:border-0 last:pb-0"
        >
          <p className="font-medium text-plum-900">{item.headline}</p>
          {item.change ? (
            <p className="mt-0.5 text-sm text-ink">{item.change}</p>
          ) : null}
          <p className="mt-1 text-slate-500 text-xs">
            <span className="angka">{formatDateTimeId(item.at)}</span>
            {" · "}
            {item.actorName ?? "Sistem"}
            {item.reason ? ` · ${item.reason}` : ""}
          </p>
        </li>
      ))}
    </ol>
  );
}
