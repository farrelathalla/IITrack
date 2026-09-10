"use server";

import type { Division, RoleName } from "@/lib/auth/types";
import { parseDateInput } from "@/lib/member/ui";
import { getAuthenticatedSession } from "@/server/auth/session";
import { assignRole, handoverRole } from "@/server/member/management";

export interface MemberFormState {
  error: string | null;
  success?: string | null;
}

export async function assignRoleAction(
  _previous: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const session = await getAuthenticatedSession();
  if (!session) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const startDate = parseDateInput(String(formData.get("startDate") ?? ""));
  if (!startDate) {
    return { error: "Tanggal mulai jabatan tidak valid." };
  }

  const endRaw = String(formData.get("endDate") ?? "").trim();
  const endDate = endRaw === "" ? null : parseDateInput(endRaw);
  if (endRaw !== "" && !endDate) {
    return { error: "Tanggal selesai jabatan tidak valid." };
  }

  const result = await assignRole({
    actor: session.actor,
    userId: String(formData.get("userId") ?? ""),
    role: String(formData.get("role") ?? "") as RoleName,
    division: String(formData.get("division") ?? "") as Division,
    period: String(formData.get("period") ?? "").trim(),
    startDate,
    endDate,
    isSystemAdmin: formData.get("isSystemAdmin") === "on",
  });

  if (!result.ok) return { error: result.reason };

  return {
    error: null,
    success: "Jabatan berhasil ditetapkan.",
  };
}

export async function handoverRoleAction(
  _previous: MemberFormState,
  formData: FormData,
): Promise<MemberFormState> {
  const session = await getAuthenticatedSession();
  if (!session) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const effectiveAt = parseDateInput(String(formData.get("effectiveAt") ?? ""));
  if (!effectiveAt) {
    return { error: "Tanggal serah terima tidak valid." };
  }

  const endRaw = String(formData.get("newEndDate") ?? "").trim();
  const newEndDate = endRaw === "" ? null : parseDateInput(endRaw);
  if (endRaw !== "" && !newEndDate) {
    return { error: "Tanggal selesai jabatan baru tidak valid." };
  }

  const result = await handoverRole({
    actor: session.actor,
    fromRoleAssignmentId: String(formData.get("fromRoleAssignmentId") ?? ""),
    toUserId: String(formData.get("toUserId") ?? ""),
    effectiveAt,
    newPeriod: String(formData.get("newPeriod") ?? "").trim(),
    newEndDate,
    reason: String(formData.get("reason") ?? ""),
  });

  if (!result.ok) return { error: result.reason };

  return {
    error: null,
    success: "Serah terima jabatan berhasil dicatat.",
  };
}
