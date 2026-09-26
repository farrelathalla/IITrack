"use client";

import {
  FolderLock,
  KeyRound,
  type LucideIcon,
  Server,
  UserRound,
  Users,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_SECTIONS, type SettingsSection } from "@/lib/settings";
import { cn } from "@/lib/utils";

const ICONS: Record<SettingsSection, LucideIcon> = {
  profile: UserRound,
  users: Users,
  permissions: KeyRound,
  workflow: Workflow,
  access: FolderLock,
  system: Server,
};

export function SettingsNav({ sections }: { sections: SettingsSection[] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5 rounded-xl border border-line bg-white p-2 shadow-sm">
      {SETTINGS_SECTIONS.filter((s) => sections.includes(s.id)).map(
        (section) => {
          const active = pathname === `/settings/${section.id}`;
          const Icon = ICONS[section.id];
          return (
            <Link
              key={section.id}
              href={`/settings/${section.id}`}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-xs transition-colors",
                active
                  ? "bg-plum-600 text-white"
                  : "text-muted hover:bg-surface hover:text-ink",
              )}
            >
              <Icon className="size-4 shrink-0" aria-hidden="true" />
              {section.label}
            </Link>
          );
        },
      )}
    </nav>
  );
}
