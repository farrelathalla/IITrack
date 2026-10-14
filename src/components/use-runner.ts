"use client";

import { useCallback, useState, useTransition } from "react";
import type { ActionResult } from "@/server/project/mutate";

/**
 * Menjalankan Server Action dan menyimpan pesan penolakannya untuk
 * ditampilkan di dekat tombol yang ditekan.
 */
export function useRunner() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const run = useCallback(
    (
      fn: () => Promise<ActionResult>,
      onSuccess?: (result: Extract<ActionResult, { ok: true }>) => void,
    ) => {
      setError(null);
      setMessage(null);
      startTransition(async () => {
        const result = await fn();
        if (result.ok) {
          setMessage(result.message ?? null);
          onSuccess?.(result);
        } else {
          setError(result.error);
        }
      });
    },
    [],
  );

  return { run, pending, error, setError, message };
}
