"use client";

import { ChevronDown, Search } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { FieldError } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { FIELD_CONTROL, FIELD_LABEL } from "@/components/ui/field-styles";
import { ROLE_LABELS } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";
import type { Candidate } from "@/server/project/people";

/**
 * Pemilih orang dengan pencarian nama atau email. Hanya menampilkan anggota
 * aktif divisi terkait beserta jumlah project aktifnya (PRD bab 8.4).
 */
export function PersonPicker({
  name,
  label,
  placeholder,
  candidates,
  error,
  value,
  onChange,
  exclude = [],
}: {
  name?: string;
  label: string;
  placeholder: string;
  candidates: Candidate[];
  error?: string;
  value?: string;
  onChange?: (id: string) => void;
  exclude?: string[];
}) {
  const [internal, setInternal] = useState("");
  const selectedId = value ?? internal;
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();

  useEffect(() => {
    function handle(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node))
        setOpen(false);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, []);

  const selected = candidates.find((c) => c.id === selectedId);
  const q = query.trim().toLowerCase();
  const visible = candidates.filter(
    (c) =>
      !exclude.includes(c.id) &&
      (!q ||
        c.name.toLowerCase().includes(q) ||
        c.email.toLowerCase().includes(q)),
  );

  function choose(id: string) {
    if (onChange) onChange(id);
    else setInternal(id);
    setOpen(false);
    setQuery("");
  }

  return (
    <div ref={ref} className="relative flex flex-col gap-1.5">
      <span className={FIELD_LABEL}>{label}</span>
      {name ? <input type="hidden" name={name} value={selectedId} /> : null}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-controls={listId}
        aria-invalid={error ? true : undefined}
        className={cn(
          FIELD_CONTROL,
          "flex items-center justify-between text-left",
        )}
      >
        {selected ? (
          <span className="flex items-center gap-2">
            <Avatar name={selected.name} />
            <span className="font-medium">{selected.name}</span>
            <span className="text-subtle text-xs">
              {ROLE_LABELS[selected.role]}
            </span>
          </span>
        ) : (
          <span className="text-subtle">{placeholder}</span>
        )}
        <ChevronDown className="size-4 text-subtle" />
      </button>
      {open ? (
        <div
          id={listId}
          className="pop-in-left absolute top-full z-30 mt-1 w-full overflow-hidden rounded-xl border border-line bg-white shadow-lg"
        >
          <div className="relative border-line border-b p-2">
            <Search className="-translate-y-1/2 absolute top-1/2 left-4 size-3.5 text-subtle" />
            <input
              // biome-ignore lint/a11y/noAutofocus: fokus langsung ke pencarian saat daftar dibuka
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau email…"
              aria-label="Cari nama atau email"
              className="w-full rounded-md bg-surface py-1.5 pr-2 pl-7 text-xs outline-none"
            />
          </div>
          <ul className="max-h-60 overflow-y-auto">
            {visible.length === 0 ? (
              <li className="px-3 py-3 text-center text-subtle text-xs">
                Tidak ditemukan.
              </li>
            ) : (
              visible.map((c) => (
                <li key={c.id}>
                  <button
                    type="button"
                    onClick={() => choose(c.id)}
                    className={cn(
                      "flex w-full items-center gap-2.5 px-3 py-2 text-left hover:bg-surface",
                      c.id === selectedId && "bg-plum-50",
                    )}
                  >
                    <Avatar name={c.name} size="md" />
                    <span className="min-w-0 flex-1">
                      <span className="block font-medium text-ink text-xs">
                        {c.name}
                      </span>
                      <span className="block truncate text-[11px] text-subtle">
                        {c.email}
                      </span>
                    </span>
                    <span className="whitespace-nowrap text-[10px] text-muted">
                      {c.activeProjects} project aktif
                    </span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </div>
  );
}
