"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge, type Tone } from "@/components/ui/badge";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { cn } from "@/lib/utils";

export interface PastProjectRow {
  code: string;
  name: string;
  typeLabel: string;
  client: string;
  myRole: string | null;
  closedLabel: string;
  year: number;
  finalLabel: string;
  finalTone: Tone;
}

const SELECT = cn(FIELD_CONTROL, "w-auto py-1.5 text-xs");

/** Tabel Project Selesai, seluruhnya read-only (PRD bab 8.2). */
export function PastProjectsTable({ rows }: { rows: PastProjectRow[] }) {
  const [query, setQuery] = useState("");
  const [year, setYear] = useState("");
  const [type, setType] = useState("");

  const years = useMemo(
    () => [...new Set(rows.map((r) => r.year))].sort((a, b) => b - a),
    [rows],
  );
  const types = useMemo(
    () => [...new Set(rows.map((r) => r.typeLabel))].sort(),
    [rows],
  );

  const filtered = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    if (q && !`${row.code} ${row.name} ${row.client}`.toLowerCase().includes(q))
      return false;
    if (year && String(row.year) !== year) return false;
    if (type && row.typeLabel !== type) return false;
    return true;
  });
  const filtering = Boolean(query || year || type);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-subtle" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari project, client…"
            aria-label="Cari project atau client"
            className={cn(FIELD_CONTROL, "w-64 py-1.5 pl-9")}
          />
        </div>
        <select
          aria-label="Filter tahun"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className={SELECT}
        >
          <option value="">Semua Tahun</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter tipe"
          value={type}
          onChange={(e) => setType(e.target.value)}
          className={SELECT}
        >
          <option value="">Semua Tipe</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {filtering ? (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setYear("");
              setType("");
            }}
            className="font-medium text-plum-600 text-xs hover:underline"
          >
            Reset filter
          </button>
        ) : null}
      </div>

      <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-line border-b bg-surface">
            <tr>
              {[
                "Project ID",
                "Project",
                "Client",
                "Peranku",
                "Tanggal Selesai",
                "Status Final",
                "Arsip",
                "",
              ].map((h) => (
                <th
                  key={h || "aksi"}
                  className="whitespace-nowrap px-4 py-2.5 font-semibold text-[11px] text-muted uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={8}
                  className="px-4 py-10 text-center text-sm text-subtle"
                >
                  {rows.length === 0
                    ? "Belum ada project yang selesai."
                    : "Tidak ada project yang cocok dengan filter."}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={row.code} className="hover:bg-surface">
                  <td className="px-4 py-3">
                    <span className="whitespace-nowrap rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-subtle">
                      {row.code}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{row.name}</p>
                    <p className="text-[11px] text-subtle">{row.typeLabel}</p>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{row.client}</td>
                  <td className="px-4 py-3">
                    {row.myRole ? (
                      <Badge tone="brand">{row.myRole}</Badge>
                    ) : (
                      <span className="text-subtle text-xs">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-muted text-xs">
                    {row.closedLabel}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={row.finalTone} dot>
                      {row.finalLabel}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone="neutral">Diarsipkan</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/projects/${row.code}`}
                      className="whitespace-nowrap font-medium text-plum-600 text-xs hover:underline"
                    >
                      Lihat Detail →
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-subtle text-xs">
        {filtered.length} project ditampilkan
      </p>
    </div>
  );
}
