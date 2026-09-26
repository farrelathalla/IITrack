"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, type Tone } from "@/components/ui/badge";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { cn } from "@/lib/utils";

export interface AllProjectRow {
  code: string;
  name: string;
  client: string;
  pm: string;
  statusLabel: string;
  statusTone: Tone;
  stageName: string;
  updatedLabel: string;
}

/**
 * Satu tabel untuk project aktif dan selesai. Filter di klien; baris yang
 * masuk sudah dibatasi server menurut jabatan dan penugasan.
 */
export function AllProjectsTable({ rows }: { rows: AllProjectRow[] }) {
  const [query, setQuery] = useState("");
  const [pm, setPm] = useState("");
  const pms = useMemo(
    () =>
      [
        ...new Set(rows.map((row) => row.pm).filter((name) => name !== "-")),
      ].sort(),
    [rows],
  );

  const filtered = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    if (
      q &&
      !`${row.code} ${row.name} ${row.client}`.toLowerCase().includes(q)
    ) {
      return false;
    }
    if (pm && row.pm !== pm) return false;
    return true;
  });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-subtle" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari Project ID…"
            aria-label="Cari Project ID atau nama"
            className={cn(FIELD_CONTROL, "w-64 py-1.5 pl-9")}
          />
        </div>
        <select
          aria-label="Filter project manager"
          value={pm}
          onChange={(event) => setPm(event.target.value)}
          className={cn(FIELD_CONTROL, "w-auto py-1.5 text-xs")}
        >
          <option value="">Semua Project Manager</option>
          {pms.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-line border-b text-muted">
            <tr>
              {[
                "Project ID",
                "Project Name",
                "Client",
                "Project Manager",
                "Status",
                "Current Stage",
                "Last Updated",
              ].map((heading) => (
                <th
                  key={heading}
                  className="whitespace-nowrap px-4 py-3 font-medium text-[11px]"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-subtle">
                  {rows.length === 0
                    ? "Belum ada project."
                    : "Tidak ada project yang cocok."}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.code} className="hover:bg-surface">
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${row.code}`}
                      className="rounded-md bg-plum-50 px-1.5 py-0.5 font-medium text-plum-600"
                    >
                      {row.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${row.code}`}
                      className="font-semibold text-ink hover:text-plum-600"
                    >
                      {row.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{row.client}</td>
                  <td className="px-4 py-3 text-ink">{row.pm}</td>
                  <td className="px-4 py-3">
                    <Badge tone={row.statusTone}>{row.statusLabel}</Badge>
                  </td>
                  <td className="px-4 py-3 text-muted">{row.stageName}</td>
                  <td className="px-4 py-3 text-muted">{row.updatedLabel}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-subtle text-xs">
        Menampilkan {filtered.length} dari {rows.length} project
      </p>
    </div>
  );
}
