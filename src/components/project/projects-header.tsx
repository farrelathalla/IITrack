import { Plus } from "lucide-react";
import Link from "next/link";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/** Judul daftar project dan tombol Tambah Project. Pilihan daftar ada di sidebar. */
export function ProjectsHeader({
  title,
  subtitle,
  canCreate,
}: {
  title: string;
  subtitle: string;
  canCreate: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <h1 className="font-bold text-ink text-xl">{title}</h1>
        <p className="mt-0.5 text-muted text-xs">{subtitle}</p>
      </div>
      {canCreate ? (
        <Link href="/projects/new" className={buttonClass("primary")}>
          <Plus className="size-4" />
          Tambah Project
        </Link>
      ) : null}
    </div>
  );
}

export function StatCard({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: number | string;
  sub: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white px-5 py-4 shadow-sm">
      <p className="mb-2 font-medium text-muted text-xs">{label}</p>
      <p className={cn("font-bold text-2xl text-ink", accent)}>{value}</p>
      <p className="mt-0.5 text-[11px] text-subtle">{sub}</p>
    </div>
  );
}
