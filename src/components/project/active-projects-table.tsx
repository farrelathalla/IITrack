"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Badge, type Tone } from "@/components/ui/badge";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { StageProgress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export interface ActiveProjectRow {
  code: string;
  name: string;
  client: string;
  pm: string;
  myRole: string | null;
  stageNumber: number;
  stageName: string;
  completed: number;
  status: string | null;
  statusLabel: string;
  statusTone: Tone;
  deadlineLabel: string | null;
  deadlineChip: string | null;
  deadlineTone: Tone;
  nextAction: string;
}

const SELECT = cn(FIELD_CONTROL, "w-auto py-1.5 text-xs");

/**
 * Tabel Project Aktif dengan pencarian dan filter PM, Stage, Status
 * (PRD bab 8.2). Data sudah dibatasi server sesuai jabatan dan penugasan.
 */
export function ActiveProjectsTable({ rows }: { rows: ActiveProjectRow[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pm, setPm] = useState("");
  const [stage, setStage] = useState("");
  const [status, setStatus] = useState("");

  const pms = useMemo(() => [...new Set(rows.map((r) => r.pm))].sort(), [rows]);
  const statuses = useMemo(
    () => [
      ...new Map(
        rows.filter((r) => r.status).map((r) => [r.status, r.statusLabel]),
      ).entries(),
    ],
    [rows],
  );

  const filtered = rows.filter((row) => {
    const q = query.trim().toLowerCase();
    if (q && !`${row.code} ${row.name} ${row.client}`.toLowerCase().includes(q))
      return false;
    if (pm && row.pm !== pm) return false;
    if (stage && String(row.stageNumber) !== stage) return false;
    if (status && row.status !== status) return false;
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
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Cari project, client…"
            aria-label="Cari project atau client"
            className={cn(FIELD_CONTROL, "w-64 py-1.5 pl-9")}
          />
        </div>
        <select
          aria-label="Filter PM"
          value={pm}
          onChange={(e) => setPm(e.target.value)}
          className={SELECT}
        >
          <option value="">Semua PM</option>
          {pms.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter stage"
          value={stage}
          onChange={(e) => setStage(e.target.value)}
          className={SELECT}
        >
          <option value="">Semua Stage</option>
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
            <option key={n} value={n}>
              Stage {n}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter status"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className={SELECT}
        >
          <option value="">Semua Status</option>
          {statuses.map(([value, label]) => (
            <option key={value} value={value ?? ""}>
              {label}
            </option>
          ))}
        </select>
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
                "Stage Saat Ini",
                "Status",
                "Deadline Terdekat",
                "Next Action",
              ].map((h) => (
                <th
                  key={h}
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
                    ? "Belum ada project aktif. Project yang kamu pegang akan muncul di sini setelah kamu ditugaskan."
                    : "Tidak ada project yang cocok."}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr
                  key={row.code}
                  onClick={() => router.push(`/projects/${row.code}`)}
                  className="cursor-pointer transition-colors hover:bg-surface"
                >
                  <td className="px-4 py-3">
                    <span className="whitespace-nowrap rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-subtle">
                      {row.code}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/projects/${row.code}`}
                      className="font-semibold text-ink hover:text-plum-600"
                    >
                      {row.name}
                    </Link>
                    <p className="text-[11px] text-subtle">PM: {row.pm}</p>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{row.client}</td>
                  <td className="px-4 py-3">
                    {row.myRole ? (
                      <Badge tone="brand">{row.myRole}</Badge>
                    ) : (
                      <span className="text-subtle text-xs">—</span>
                    )}
                  </td>
                  <td className="w-44 px-4 py-3">
                    <p className="mb-1 font-medium text-ink text-xs">
                      {row.stageName}
                    </p>
                    <StageProgress value={row.completed} total={9} />
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={row.statusTone} dot>
                      {row.statusLabel}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {row.deadlineLabel ? (
                      <div className="space-y-0.5">
                        <Badge tone={row.deadlineTone}>
                          {row.deadlineChip}
                        </Badge>
                        <p className="text-muted text-xs">
                          {row.deadlineLabel}
                        </p>
                      </div>
                    ) : (
                      <span className="text-subtle text-xs">—</span>
                    )}
                  </td>
                  <td className="max-w-56 px-4 py-3 text-muted text-xs">
                    {row.nextAction}
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
