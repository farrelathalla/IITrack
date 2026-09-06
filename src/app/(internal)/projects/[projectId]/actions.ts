"use server";

import { findStage, STAGE_CATALOGUE } from "@/lib/project/stages";
import type { TerminDraft } from "@/lib/termin/scheme";
import { getAuthenticatedSession } from "@/server/auth/session";
import { projectContextFor } from "@/server/project/context";
import { changeProjectStage } from "@/server/project/stage";
import { saveTerminScheme } from "@/server/project/termin";

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

export interface SaveTerminFormState {
  error: string | null;
  success?: string | null;
  savedAt?: number;
}

function draftsFromForm(formData: FormData): TerminDraft[] | { error: string } {
  const rawCount = String(formData.get("rowCount") ?? "").trim();
  const rowCount = Number.parseInt(rawCount, 10);
  if (!Number.isInteger(rowCount) || rowCount < 1) {
    return {
      error:
        "Skema termin kosong tidak bisa disimpan. Isi paling tidak dua termin, karena uang muka harus 25 sampai 50 persen.",
    };
  }

  const drafts: TerminDraft[] = [];
  for (let index = 0; index < rowCount; index += 1) {
    drafts.push({
      sequence: index + 1,
      percentage: String(formData.get(`percentage-${index}`) ?? ""),
      amount: String(formData.get(`amount-${index}`) ?? ""),
      dueDate: String(formData.get(`dueDate-${index}`) ?? ""),
    });
  }
  return drafts;
}

export async function saveTerminSchemeAction(
  _previous: SaveTerminFormState,
  formData: FormData,
): Promise<SaveTerminFormState> {
  const session = await getAuthenticatedSession();
  if (!session) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const projectDbId = String(formData.get("projectDbId") ?? "").trim();
  if (!projectDbId) {
    return { error: "Project yang dimaksud tidak ditemukan." };
  }

  const parsed = draftsFromForm(formData);
  if (!Array.isArray(parsed)) return { error: parsed.error };

  const result = await saveTerminScheme({
    actor: session.actor,
    projectDbId,
    drafts: parsed,
  });

  if (!result.ok) return { error: result.reason };

  return {
    error: null,
    success: `Skema ${result.count} termin disimpan.`,
    savedAt: Date.now(),
  };
}
