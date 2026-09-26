"use client";

import { useState } from "react";
import {
  markAllReadAction,
  openNotificationAction,
} from "@/app/(internal)/actions";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function NotificationList({
  items,
}: {
  items: { id: string; message: string; time: string; unread: boolean }[];
}) {
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const shown =
    filter === "unread" ? items.filter((item) => item.unread) : items;
  const unread = items.filter((item) => item.unread).length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <div className="flex rounded-full bg-white p-1 shadow-sm">
          <FilterButton
            current={filter === "all"}
            onClick={() => setFilter("all")}
          >
            All
          </FilterButton>
          <FilterButton
            current={filter === "unread"}
            onClick={() => setFilter("unread")}
          >
            Unread
          </FilterButton>
        </div>
        {unread > 0 ? (
          <form action={markAllReadAction}>
            <Button type="submit" variant="secondary" size="sm">
              Mark all as read
            </Button>
          </form>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-2xl border border-line bg-white shadow-sm">
        {shown.length === 0 ? (
          <p className="p-10 text-center text-xs text-subtle">
            {items.length === 0
              ? "Belum ada notifikasi."
              : "Tidak ada notifikasi yang belum dibaca."}
          </p>
        ) : (
          shown.map((item) => (
            <form
              key={item.id}
              action={openNotificationAction.bind(null, item.id)}
            >
              <button
                type="submit"
                className="flex w-full items-start gap-3 border-surface border-b px-5 py-4 text-left last:border-0 hover:bg-surface"
              >
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-plum-50 text-plum-600">
                  <span className="size-1.5 rounded-full bg-plum-600" />
                </span>
                <span className="min-w-0 flex-1">
                  <span
                    className={cn(
                      "block text-sm",
                      item.unread ? "font-semibold text-ink" : "text-muted",
                    )}
                  >
                    {item.message}
                  </span>
                  <span className="mt-0.5 block text-[11px] text-subtle">
                    {item.time}
                  </span>
                </span>
                {item.unread ? (
                  <span className="mt-2 size-2 shrink-0 rounded-full bg-plum-600" />
                ) : null}
              </button>
            </form>
          ))
        )}
      </div>
      <p className="text-subtle text-xs">
        Menampilkan {shown.length} dari {items.length} notifikasi
      </p>
    </div>
  );
}

function FilterButton({
  current,
  onClick,
  children,
}: {
  current: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-full px-3 py-1 font-medium text-xs",
        current ? "bg-plum-600 text-white" : "text-muted hover:text-ink",
      )}
    >
      {children}
    </button>
  );
}
