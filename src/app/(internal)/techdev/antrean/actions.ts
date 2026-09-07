"use server";

import { getAuthenticatedSession } from "@/server/auth/session";
import { fulfillStaffingRequest } from "@/server/techdev/staffing";

export interface FulfillStaffingFormState {
  error: string | null;
  success?: string | null;
  savedAt?: number;
}

export async function fulfillStaffingAction(
  _previous: FulfillStaffingFormState,
  formData: FormData,
): Promise<FulfillStaffingFormState> {
  const session = await getAuthenticatedSession();
  if (!session) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const requestId = String(formData.get("requestId") ?? "").trim();
  if (!requestId) {
    return { error: "Permintaan yang dimaksud tidak ditemukan." };
  }

  const memberUserIds = formData
    .getAll("memberUserIds")
    .map((value) => String(value).trim())
    .filter((value) => value.length > 0);

  const result = await fulfillStaffingRequest({
    actor: session.actor,
    requestId,
    memberUserIds,
  });

  if (!result.ok) return { error: result.reason };

  return {
    error: null,
    success: "Anggota ditetapkan. Permintaan hilang dari antrean.",
    savedAt: Date.now(),
  };
}
