"use server";

import { findStage, STAGE_CATALOGUE } from "@/lib/project/stages";
import { getAuthenticatedSession } from "@/server/auth/session";
import { projectContextFor } from "@/server/project/context";
import { changeProjectStage } from "@/server/project/stage";

export interface ChangeStageFormState {
  error: string | null;
  success?: string | null;
  savedAt?: number;
}

export async function changeProjectStageAction(
  _previous: ChangeStageFormState,
  formData: FormData,
): Promise<ChangeStageFormState> {
  const session = await getAuthenticatedSession();
  if (!session) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const projectDbId = String(formData.get("projectDbId") ?? "").trim();
  const toStage = String(formData.get("toStage") ?? "").trim();
  const noteRaw = String(formData.get("note") ?? "").trim();

  if (!projectDbId) {
    return { error: "Project yang dimaksud tidak ditemukan." };
  }
  if (!toStage) {
    return { error: "Pilih tahap tujuan terlebih dahulu." };
  }

  const konteks = await projectContextFor(session.actor, projectDbId);
  const result = await changeProjectStage({
    actor: session.actor,
    projectDbId,
    toStage,
    note: noteRaw.length === 0 ? null : noteRaw,
    assignedDivisions: konteks.assignedDivisions,
  });

  if (!result.changed) return { error: result.reason };

  const label =
    findStage(STAGE_CATALOGUE, result.toStage)?.label ?? result.toStage;
  return {
    error: null,
    success: `Tahap dipindahkan ke ${label}.`,
    savedAt: Date.now(),
  };
}
