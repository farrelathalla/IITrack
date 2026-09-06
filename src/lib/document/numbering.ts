import { isValidProjectId } from "@/lib/project/project-id";

/**
 * Penomoran invoice dan kuitansi (F20).
 *
 * Polanya mengikuti IITBOOK 3.7 dan 3.8 sebagaimana dikutip PRD bab 2.2:
 * invoice `#02-[Project ID]` dan kuitansi `#01-[Project ID]`.
 */

export type DocumentKind = "RECEIPT" | "INVOICE";

/** Awalan dua digit per jenis dokumen. Kuitansi 01, invoice 02. */
export const DOCUMENT_PREFIX: Record<DocumentKind, string> = {
  RECEIPT: "01",
  INVOICE: "02",
};

const PREFIX_TO_KIND: Record<string, DocumentKind> = {
  "01": "RECEIPT",
  "02": "INVOICE",
};

const DOCUMENT_NUMBER_PATTERN =
  /^#(0[12])-(IIT-\d{4}-(?:00[1-9]|0[1-9]\d|[1-9]\d{2,}))$/;

/**
 * Menyusun nomor dokumen dari jenis dan Project ID-nya.
 *
 * Project ID yang bentuknya salah ditolak di sini, supaya nomor dokumen tidak
 * pernah menunjuk ke project yang tidak ada.
 */
export function formatDocumentNumber(
  kind: DocumentKind,
  projectId: string,
): string {
  if (!isValidProjectId(projectId)) {
    throw new Error(
      `Project ID ${projectId} tidak sesuai format IIT-NNNN-NNN, jadi nomor dokumennya tidak bisa diterbitkan.`,
    );
  }

  return `#${DOCUMENT_PREFIX[kind]}-${projectId}`;
}

export interface ParsedDocumentNumber {
  kind: DocumentKind;
  projectId: string;
}

/** Mengembalikan `null` bila bentuknya tidak dikenal, bukan menebak maksudnya. */
export function parseDocumentNumber(
  value: string,
): ParsedDocumentNumber | null {
  const match = DOCUMENT_NUMBER_PATTERN.exec(value);
  if (!match) return null;

  const kind = PREFIX_TO_KIND[match[1]];
  if (!kind) return null;

  return { kind, projectId: match[2] };
}
