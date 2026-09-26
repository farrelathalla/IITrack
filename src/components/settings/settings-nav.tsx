"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_SECTIONS, type SettingsSection } from "@/lib/settings";
import { cn } from "@/lib/utils";

export function SettingsNav({ sections }: { sections: SettingsSection[] }) {
  const pathname = usePathname();
  return (
    <nav className="space-y-0.5 rounded-xl border border-line bg-white p-2 shadow-sm">
      {SETTINGS_SECTIONS.filter((s) => sections.includes(s.id)).map(
        (section) => {
          const active = pathname === `/settings/${section.id}`;
          return (
            <Link
              key={section.id}
              href={`/settings/${section.id}`}
              className={cn(
                "flex items-center gap-2.5 rounded-lg px-3 py-2 font-medium text-sm transition-colors",
                active
                  ? "bg-plum-600 text-white"
                  : "text-muted hover:bg-surface hover:text-ink",
              )}
            >
              <span aria-hidden="true" className="text-sm">
                {section.icon}
              </span>
              {section.label}
            </Link>
          );
        },
      )}
    </nav>
  );
}
