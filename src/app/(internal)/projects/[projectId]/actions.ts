"use server";

import { parseInvoiceRequestForm } from "@/lib/finance/invoice-form";
import { parseReferenceForm } from "@/lib/project/reference-form";
import { findStage, STAGE_CATALOGUE } from "@/lib/project/stages";
import { parseStaffingRequestForm } from "@/lib/staffing/form";
import type { TerminDraft } from "@/lib/termin/scheme";
import { MAX_TERMIN_ROWS } from "@/lib/termin/scheme";
import { getAuthenticatedSession } from "@/server/auth/session";
import { requestInvoice } from "@/server/finance/invoice";
import { addReference } from "@/server/project/references";
import { changeProjectStage } from "@/server/project/stage";
import { saveTerminScheme } from "@/server/project/termin";
import { requestStaffing } from "@/server/techdev/staffing";

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

  const result = await changeProjectStage({
    actor: session.actor,
    projectDbId,
    toStage,
    note: noteRaw.length === 0 ? null : noteRaw,
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

  // Jumlah baris berasal dari permintaan, sedangkan izin baru diperiksa di
  // dalam saveTerminScheme. Tanpa batas di sini, siapa pun yang sudah masuk
  // bisa meminta puluhan juta baris dan seluruhnya dibangun lebih dulu,
  // sebelum ada yang memeriksa bahwa ia tidak berhak mengubah project itu.
  if (rowCount > MAX_TERMIN_ROWS) {
    return {
      error: `Satu skema termin paling banyak ${MAX_TERMIN_ROWS} baris.`,
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

export interface RequestStaffingFormState {
  error: string | null;
  fields?: Record<string, string>;
  success?: string | null;
  savedAt?: number;
}

export async function requestStaffingAction(
  _previous: RequestStaffingFormState,
  formData: FormData,
): Promise<RequestStaffingFormState> {
  const session = await getAuthenticatedSession();
  if (!session) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const projectDbId = String(formData.get("projectDbId") ?? "").trim();
  if (!projectDbId) {
    return { error: "Project yang dimaksud tidak ditemukan." };
  }

  const parsed = parseStaffingRequestForm({
    roleNeeded: String(formData.get("roleNeeded") ?? ""),
    headcount: String(formData.get("headcount") ?? ""),
    neededBy: String(formData.get("neededBy") ?? ""),
    technicalNeeds: String(formData.get("technicalNeeds") ?? ""),
    deliverable: String(formData.get("deliverable") ?? ""),
  });
  if (!parsed.ok) {
    return { error: parsed.reason, fields: parsed.fields };
  }

  const result = await requestStaffing({
    actor: session.actor,
    projectDbId,
    ...parsed.data,
  });

  if (!result.ok) {
    return { error: result.reason, fields: result.fields };
  }

  return {
    error: null,
    success: "Permintaan tenaga programmer diajukan ke antrean TechDev.",
    savedAt: Date.now(),
  };
}

export interface RequestInvoiceFormState {
  error: string | null;
  fields?: Record<string, string>;
  success?: string | null;
  savedAt?: number;
}

export async function requestInvoiceAction(
  _previous: RequestInvoiceFormState,
  formData: FormData,
): Promise<RequestInvoiceFormState> {
  const session = await getAuthenticatedSession();
  if (!session) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const parsed = parseInvoiceRequestForm({
    terminId: String(formData.get("terminId") ?? ""),
    description: String(formData.get("description") ?? ""),
    notes: String(formData.get("notes") ?? ""),
  });
  if (!parsed.ok) {
    return { error: parsed.reason, fields: parsed.fields };
  }

  const result = await requestInvoice({
    actor: session.actor,
    terminId: parsed.data.terminId,
    description: parsed.data.description,
    notes: parsed.data.notes,
  });

  if (!result.ok) return { error: result.reason };

  return {
    error: null,
    success: `Invoice ${result.number} diajukan ke langkah persetujuan pertama.`,
    savedAt: Date.now(),
  };
}

export interface AddReferenceFormState {
  error: string | null;
  fields?: Record<string, string>;
  success?: string | null;
  savedAt?: number;
}

export async function addReferenceAction(
  _previous: AddReferenceFormState,
  formData: FormData,
): Promise<AddReferenceFormState> {
  const session = await getAuthenticatedSession();
  if (!session) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const parsed = parseReferenceForm({
    projectDbId: String(formData.get("projectDbId") ?? ""),
    url: String(formData.get("url") ?? ""),
    label: String(formData.get("label") ?? ""),
  });
  if (!parsed.ok) {
    return { error: parsed.reason, fields: parsed.fields };
  }

  const result = await addReference({
    actor: session.actor,
    projectDbId: parsed.data.projectDbId,
    url: parsed.data.url,
    label: parsed.data.label,
  });

  if (!result.ok) return { error: result.reason };

  return {
    error: null,
    success: "Tautan tersimpan di Project Hub.",
    savedAt: Date.now(),
  };
}
