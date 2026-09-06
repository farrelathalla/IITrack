"use server";

import { getAuthenticatedSession } from "@/server/auth/session";
import { createClient } from "@/server/client/management";

export interface ClientFormState {
  error: string | null;
  success?: string | null;
  savedAt?: number;
}

export async function createClientAction(
  _previous: ClientFormState,
  formData: FormData,
): Promise<ClientFormState> {
  const session = await getAuthenticatedSession();
  if (!session) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const result = await createClient({
    actor: session.actor,
    draft: {
      name: String(formData.get("name") ?? ""),
      contact: String(formData.get("contact") ?? ""),
      address: String(formData.get("address") ?? ""),
      npwp: String(formData.get("npwp") ?? ""),
    },
  });

  if (!result.ok) return { error: result.reason };

  const name = String(formData.get("name") ?? "").trim();
  return {
    error: null,
    success: `Client ${name} tersimpan di master data.`,
    savedAt: Date.now(),
  };
}
