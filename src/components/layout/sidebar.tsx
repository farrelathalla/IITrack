"use client";

import {
  Bell,
  ChevronDown,
  Folder,
  LayoutGrid,
  LogOut,
  Settings,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

const LINK =
  "flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium text-sm transition-colors";
const ACTIVE = "bg-white/15 text-white";
const IDLE = "text-white/70 hover:bg-white/10 hover:text-white";

function BrandLogo() {
  return (
    <Image
      src="/logo-iit.png"
      alt="Inkubator IT"
      width={180}
      height={40}
      unoptimized
      className="h-9 w-auto mix-blend-screen"
    />
  );
}

/**
 * Sidebar kiri prototipe GRAH: logo Inkubator IT, empat menu, dan identitas
 * pengguna. Isi Settings tidak mengikuti prototipe; yang lain mengikuti
 * susunan menunya.
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
  const [expanded, setExpanded] = useState(inProjects);

  const onAll = pathname === "/projects/all";
  const onPast = pathname.startsWith("/projects/past");
  const onActive = pathname === "/projects";

  return (
    <aside className="fixed inset-y-0 left-0 z-20 flex w-60 select-none flex-col bg-[linear-gradient(180deg,#10091F_0%,#241229_33%,#3B2020_66%,#5A310F_100%)]">
      <div className="px-5 pt-6 pb-4">
        <Link href="/" className="inline-flex">
          <BrandLogo />
        </Link>
      </div>

      <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
        <Link href="/" className={cn(LINK, pathname === "/" ? ACTIVE : IDLE)}>
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
              Project
            </span>
            <ChevronDown
              className={cn(
                "size-3.5 transition-transform",
                expanded && "rotate-180",
              )}
            />
          </button>
          {expanded ? (
            <div className="mt-0.5 ml-4 space-y-0.5 border-white/15 border-l pl-3">
              <Link
                href="/projects/all"
                className={cn(
                  "block rounded-lg px-3 py-2 font-medium text-xs transition-colors",
                  onAll ? ACTIVE : IDLE,
                )}
              >
                All Projects
              </Link>
              <Link
                href="/projects"
                className={cn(
                  "block rounded-lg px-3 py-2 font-medium text-xs transition-colors",
                  onActive ? ACTIVE : IDLE,
                )}
              >
                Active Projects
              </Link>
              <Link
                href="/projects/past"
                className={cn(
                  "block rounded-lg px-3 py-2 font-medium text-xs transition-colors",
                  onPast ? ACTIVE : IDLE,
                )}
              >
                Past Projects
              </Link>
            </div>
          ) : null}
        </div>

        <Link
          href="/notifications"
          className={cn(
            LINK,
            pathname.startsWith("/notifications") ? ACTIVE : IDLE,
          )}
        >
          <Bell className="size-4 shrink-0" />
          <span className="flex-1">Notifications</span>
          {unread > 0 ? (
            <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-[#e8a317] px-1.5 py-px font-bold text-[10px] text-white">
              {unread}
            </span>
          ) : null}
        </Link>

        <Link
          href="/settings/profile"
          className={cn(LINK, pathname.startsWith("/settings") ? ACTIVE : IDLE)}
        >
          <Settings className="size-4 shrink-0" />
          Settings
        </Link>
      </nav>

      <div className="px-3 pt-3 pb-4">
        <div className="flex items-center gap-2.5 rounded-lg px-2 py-2">
          <Avatar name={name} size="md" />
          <div className="min-w-0 flex-1">
            <div className="truncate font-semibold text-white text-xs">
              {name}
            </div>
            <div className="truncate text-[10px] text-white/55">
              {roleLabel}
            </div>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              title="Keluar"
              aria-label="Keluar"
              className="rounded-md p-1.5 text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            >
              <LogOut className="size-3.5" />
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}
