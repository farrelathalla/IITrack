import { z } from "zod";

/** Tautan dokumen harus berupa URL valid (PRD bab 10). */
export function isValidLink(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export const linkSchema = z
  .string()
  .trim()
  .min(1, "Tautan wajib diisi.")
  .refine(isValidLink, "Tautan harus berupa URL valid, diawali https://.");

/** Tautan opsional: string kosong dibaca sebagai tidak diisi. */
export const optionalLinkSchema = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : null))
  .refine(
    (value) => value === null || isValidLink(value),
    "Tautan harus berupa URL valid, diawali https://.",
  );

export const feedbackSchema = z
  .string()
  .trim()
  .min(1, "Feedback wajib diisi saat menolak.");

/** Mengubah galat zod menjadi peta pesan per kolom. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const fields: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.map(String).join(".") || "form";
    if (!fields[key]) fields[key] = issue.message;
  }
  return fields;
}
