"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { cn } from "@/lib/utils";

export interface AccessRow {
  code: string;
  name: string;
  client: string;
  pm: string[];
  developers: string[];
  financePoc: string[];
}

const COLUMNS = [
  { key: "pm", label: "Project Management", tab: "pm" },
  { key: "developers", label: "Tech Development", tab: "tech" },
  { key: "financePoc", label: "Finance", tab: "finance" },
] as const;

/**
 * Project Access (PRD bab 8.7): siapa yang punya akses edit per divisi. C-Level
 * mendapat tombol Manage Access untuk divisinya, yang membuka modal penugasan
 * di Project Detail.
 */
export function AccessSection({
  rows,
  manageTab,
}: {
  rows: AccessRow[];
  manageTab: "pm" | "tech" | "finance" | null;
}) {
  const [query, setQuery] = useState("");
  const q = query.trim().toLowerCase();
  const filtered = rows.filter(
    (r) => !q || `${r.code} ${r.name} ${r.client}`.toLowerCase().includes(q),
  );

  return (
    <div className="space-y-3">
      <div className="relative w-72">
        <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-subtle" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari project..."
          aria-label="Cari project"
          className={cn(FIELD_CONTROL, "py-1.5 pl-9")}
        />
      </div>
      <div className="space-y-3">
        {filtered.length === 0 ? (
          <p className="rounded-xl border border-line bg-white p-8 text-center text-sm text-subtle">
            Tidak ada project yang cocok.
          </p>
        ) : (
          filtered.map((row) => (
            <div
              key={row.code}
              className="rounded-xl border border-line bg-white p-4 shadow-sm"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-ink">{row.name}</p>
                  <p className="font-mono text-[11px] text-subtle">
                    {row.code} · {row.client}
                  </p>
                </div>
                {manageTab ? (
                  <Link
                    href={`/projects/${row.code}?tab=${manageTab}`}
                    className="pressable rounded-lg border border-plum-200 px-3 py-1.5 font-semibold text-plum-600 text-xs hover:bg-plum-50"
                  >
                    Manage Access
                  </Link>
                ) : null}
              </div>
              <div className="grid grid-cols-3 gap-3">
                {COLUMNS.map((col) => {
                  const people = row[col.key];
                  return (
                    <div key={col.key} className="rounded-lg bg-surface p-3">
                      <p className="mb-2 font-semibold text-[10px] text-muted uppercase tracking-wider">
                        {col.label}
                      </p>
                      {people.length === 0 ? (
                        <p className="text-subtle text-xs">Belum ada</p>
                      ) : (
                        people.map((name) => (
                          <p
                            key={name}
                            className="flex items-center gap-1.5 py-0.5 text-ink text-xs"
                          >
                            <Avatar name={name} size="xs" />
                            {name}
                          </p>
                        ))
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
