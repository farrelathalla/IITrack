"use client";

import {
  Bell,
  ChevronRight,
  Folder,
  LayoutGrid,
  LogOut,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const LINK =
  "flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-sm transition-colors";
const ACTIVE = "bg-plum-600 text-white";
const IDLE = "text-navy-300 hover:bg-navy-800 hover:text-white";

export function LogoMark() {
  return (
    <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-plum-600">
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-4 text-white"
        aria-hidden="true"
      >
        <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
      </svg>
    </span>
  );
}

/**
 * Sidebar kiri: logo, empat menu, dan kartu identitas pengguna (PRD bab 3).
 * Pemilih "Demo Role" pada prototipe sengaja tidak dibangun.
 */
export function Sidebar({
  name,
  roleLabel,
  unread,
  logoutAction,
}: {
  name: string;
  roleLabel: string;
  unread: number;
  logoutAction: () => Promise<void>;
}) {
  const pathname = usePathname();
  const inProjects = pathname.startsWith("/projects");
  const [expanded, setExpanded] = useState(true);

  const isActive = (href: string, exact = false) =>
    exact ? pathname === href : pathname.startsWith(href);

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-60 select-none flex-col bg-navy-900">
      <div className="border-navy-800 border-b px-5 pt-6 pb-5">
        <Link href="/" className="flex items-center gap-2.5">
          <LogoMark />
          <div>
            <div className="font-bold text-sm text-white leading-tight">
              IITrack
            </div>
            <div className="text-[10px] text-navy-400 leading-tight">
              Inkubator IT HMIF ITB
            </div>
          </div>
        </Link>
      </div>

      <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3 py-4">
        <Link
          href="/"
          className={cn(LINK, isActive("/", true) ? ACTIVE : IDLE)}
        >
          <LayoutGrid className="size-4 shrink-0" />
          Dashboard
        </Link>

        <div>
          <button
            type="button"
            onClick={() => setExpanded((open) => !open)}
            aria-expanded={expanded}
            className={cn(
              LINK,
              "w-full justify-between",
              inProjects && !expanded ? ACTIVE : IDLE,
            )}
          >
            <span className="flex items-center gap-3">
              <Folder className="size-4 shrink-0" />
              Semua Project
            </span>
            <ChevronRight
              className={cn(
                "size-3.5 transition-transform",
                expanded && "rotate-90",
              )}
            />
          </button>
          {expanded ? (
            <div className="mt-0.5 ml-4 space-y-0.5 border-navy-800 border-l pl-3">
              <Link
                href="/projects"
                className={cn(
                  "block rounded-lg px-3 py-2 font-medium text-xs transition-colors",
                  inProjects && !isActive("/projects/past") ? ACTIVE : IDLE,
                )}
              >
                Project Aktif
              </Link>
              <Link
                href="/projects/past"
                className={cn(
                  "block rounded-lg px-3 py-2 font-medium text-xs transition-colors",
                  isActive("/projects/past") ? ACTIVE : IDLE,
                )}
              >
                Project Selesai
              </Link>
            </div>
          ) : null}
        </div>

        <Link
          href="/notifications"
          className={cn(LINK, isActive("/notifications") ? ACTIVE : IDLE)}
        >
          <Bell className="size-4 shrink-0" />
          <span className="flex-1">Notifikasi</span>
          {unread > 0 ? (
            <span className="rounded-full bg-warning-dot px-1.5 py-px font-bold text-[10px] text-white">
              {unread}
            </span>
          ) : null}
        </Link>

        <Link
          href="/settings/profile"
          className={cn(LINK, isActive("/settings") ? ACTIVE : IDLE)}
        >
          <Settings className="size-4 shrink-0" />
          Pengaturan
        </Link>
      </nav>

      <div className="border-navy-800 border-t px-3 pt-3 pb-4">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <Avatar name={name} size="md" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-white text-xs">
              {name}
            </div>
            <div className="truncate text-[10px] text-navy-400">
              {roleLabel}
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Keluar"
              aria-label="Keluar"
              className="rounded-md p-1.5 text-navy-400 transition-colors hover:bg-navy-800 hover:text-white"
            >
              <LogOut className="size-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
