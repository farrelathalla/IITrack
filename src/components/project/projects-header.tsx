import { Plus } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

/** Judul, subjudul, tab Aktif/Selesai, dan tombol Tambah Project (PRD bab 8.2). */
export function ProjectsHeader({
  active,
  canCreate,
}: {
  active: "active" | "past";
  canCreate: boolean;
}) {
  const tab = (href: string, label: string, current: boolean) => (
    <Link
      href={href}
      aria-current={current ? "page" : undefined}
      className={cn(
        "-mb-px border-b-2 px-4 py-2.5 font-semibold text-sm transition-colors",
        current
          ? "border-plum-600 text-plum-600"
          : "border-transparent text-muted hover:text-ink",
      )}
    >
      {label}
    </Link>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="font-bold text-ink text-xl">Semua Project</h1>
          <p className="mt-0.5 text-muted text-sm">
            Direktori project organisasi Inkubator IT
          </p>
        </div>
        {canCreate ? (
          <Link
            href="/projects/new"
            className="inline-flex items-center gap-1.5 rounded-lg bg-plum-600 px-4 py-2 font-semibold text-sm text-white hover:bg-plum-700"
          >
            <Plus className="size-4" />
            Tambah Project
          </Link>
        ) : null}
      </div>
      <nav
        className="flex border-line border-b"
        aria-label="Pilihan daftar project"
      >
        {tab("/projects", "Project Aktif", active === "active")}
        {tab("/projects/past", "Project Selesai", active === "past")}
      </nav>
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
    <div className="rounded-xl border border-line bg-white px-5 py-4 shadow-sm">
      <p className="mb-2 font-medium text-muted text-xs">{label}</p>
      <p className={cn("font-bold text-3xl", accent ?? "text-ink")}>{value}</p>
      <p className="mt-0.5 text-[11px] text-subtle">{sub}</p>
    </div>
  );
}
