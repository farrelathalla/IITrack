"use client";

import { type ReactNode, useCallback, useEffect, useId, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Kotak dialog berbasis elemen `<dialog>` bawaan peramban.
 *
 * Tidak menambah dependensi Radix/shadcn untuk modal. Pemanggil mengontrol
 * `open` / `onOpenChange`. Escape (bawaan `<dialog>`) dan tombol Tutup
 * menutup dialog.
 */
export function Dialog({
  open,
  onOpenChange,
  title,
  children,
  className,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    if (open) {
      if (!node.open) node.showModal();
    } else if (node.open) {
      node.close();
    }
  }, [open]);

  const handleClose = useCallback(() => {
    onOpenChange(false);
  }, [onOpenChange]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      className={cn(
        "m-auto w-[min(100%-2rem,28rem)] rounded-card border border-line bg-white p-0 text-ink shadow-lg open:flex open:flex-col",
        "backdrop:bg-ink/40",
        className,
      )}
      onClose={handleClose}
    >
      <div className="flex items-start justify-between gap-3 border-line border-b px-5 py-4">
        <h2 id={titleId} className="text-base">
          {title}
        </h2>
        <Button
          type="button"
          variant="ghost"
          className="px-2 py-1 no-underline"
          onClick={handleClose}
          aria-label="Tutup"
        >
          Tutup
        </Button>
      </div>
      <div className="px-5 py-4">{children}</div>
    </dialog>
  );
}
