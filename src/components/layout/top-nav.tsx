"use client";

import { Bell, Search } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  openNotificationAction,
  type SearchHit,
  searchAction,
} from "@/app/(internal)/actions";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

export interface NotificationPreview {
  id: string;
  message: string;
  time: string;
  unread: boolean;
}

function useClickOutside(onOutside: () => void) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    function handle(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onOutside();
      }
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [onOutside]);
  return ref;
}

function ProjectSearch() {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const ref = useClickOutside(() => setOpen(false));

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setHits([]);
      return;
    }
    const timer = setTimeout(() => {
      startTransition(async () => {
        setHits(await searchAction(q));
      });
    }, 200);
    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div ref={ref} className="relative">
      <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-subtle" />
      <input
        type="search"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        placeholder="Cari project..."
        aria-label="Cari project berdasarkan Project ID, nama, atau client"
        className="w-64 rounded-lg border border-line bg-surface py-1.5 pr-4 pl-9 text-sm transition-colors placeholder:text-subtle focus:border-plum-600 focus:bg-white focus:outline-none"
      />
      {open && query.trim() ? (
        <div className="absolute top-10 right-0 z-50 w-80 overflow-hidden rounded-xl border border-line bg-white shadow-lg">
          {hits.length === 0 ? (
            <p className="px-4 py-3 text-subtle text-xs">
              {pending ? "Mencari…" : "Tidak ada project yang cocok."}
            </p>
          ) : (
            hits.map((hit) => (
              <Link
                key={hit.code}
                href={`/projects/${hit.code}`}
                onClick={() => {
                  setOpen(false);
                  setQuery("");
                }}
                className="block border-surface border-b px-4 py-2.5 last:border-0 hover:bg-surface"
              >
                <div className="flex items-center gap-2">
                  <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-subtle">
                    {hit.code}
                  </span>
                  {hit.closed ? (
                    <span className="text-[10px] text-subtle">Selesai</span>
                  ) : null}
                </div>
                <p className="mt-0.5 font-semibold text-ink text-sm">
                  {hit.name}
                </p>
                <p className="text-muted text-xs">{hit.client}</p>
              </Link>
            ))
          )}
        </div>
      ) : null}
    </div>
  );
}

function NotificationBell({
  notifications,
  unread,
}: {
  notifications: NotificationPreview[];
  unread: number;
}) {
  const [open, setOpen] = useState(false);
  const ref = useClickOutside(() => setOpen(false));

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-label={`Notifikasi${unread > 0 ? `, ${unread} belum dibaca` : ""}`}
        aria-expanded={open}
        className="relative flex size-8 items-center justify-center rounded-lg transition-colors hover:bg-surface"
      >
        <Bell className="size-5 text-muted" />
        {unread > 0 ? (
          <span className="absolute top-1 right-1 size-2 rounded-full bg-warning-dot" />
        ) : null}
      </button>
      {open ? (
        <div className="absolute top-10 right-0 z-50 w-80 overflow-hidden rounded-xl border border-line bg-white shadow-lg">
          <div className="flex items-center justify-between border-line border-b px-4 py-3">
            <span className="font-semibold text-ink text-sm">Notifikasi</span>
            <Link
              href="/notifications"
              onClick={() => setOpen(false)}
              className="font-medium text-plum-600 text-xs hover:underline"
            >
              Lihat semua
            </Link>
          </div>
          {notifications.length === 0 ? (
            <p className="px-4 py-6 text-center text-subtle text-xs">
              Belum ada notifikasi.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto">
              {notifications.map((item) => (
                <form
                  key={item.id}
                  action={openNotificationAction.bind(null, item.id)}
                >
                  <button
                    type="submit"
                    className={cn(
                      "flex w-full gap-3 border-surface border-b px-4 py-3 text-left last:border-0 hover:bg-surface",
                      item.unread && "bg-plum-50",
                    )}
                  >
                    <span
                      className={cn(
                        "mt-1.5 size-2 shrink-0 rounded-full",
                        item.unread ? "bg-plum-600" : "bg-transparent",
                      )}
                    />
                    <span>
                      <span className="block text-ink text-xs leading-relaxed">
                        {item.message}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-subtle">
                        {item.time}
                      </span>
                    </span>
                  </button>
                </form>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Top bar: pencarian project, lonceng notifikasi, dan avatar (PRD bab 3). */
export function TopNav({
  name,
  notifications,
  unread,
}: {
  name: string;
  notifications: NotificationPreview[];
  unread: number;
}) {
  return (
    <header className="sticky top-0 z-10 flex h-14 items-center gap-4 border-line border-b bg-white px-6">
      <div className="flex-1" />
      <ProjectSearch />
      <NotificationBell notifications={notifications} unread={unread} />
      <Link href="/settings/profile" aria-label="Profil">
        <Avatar name={name} size="md" />
      </Link>
    </header>
  );
}
