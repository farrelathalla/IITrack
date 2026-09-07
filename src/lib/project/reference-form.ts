/**
 * Kontrak tampilan F25-T02 (formulir dan daftar tautan rujukan di hub).
 *
 * Modul ini murni: tanpa React/Prisma. IITrack tidak menyalin berkasnya;
 * yang disimpan hanya alamat https bersama Project ID.
 */

import { can } from "@/lib/auth/permissions";
import type { Actor, ProjectContext } from "@/lib/auth/types";
import type { ReferenceKind } from "@/lib/project/external-reference";
import {
  classifyReferenceUrl,
  normalizeReferenceUrl,
  parseGithubRepo,
} from "@/lib/project/external-reference";

export const REFERENCE_FORM_PLACEMENT = {
  surface: "hub",
  section: "documents",
} as const;

export type ReferenceFormFieldKey = "url" | "label";

export interface ReferenceFormField {
  key: ReferenceFormFieldKey;
  label: string;
  required: true;
  control: "url" | "text";
}

export const REFERENCE_FORM_FIELDS: readonly ReferenceFormField[] = [
  {
    key: "url",
    label: "Alamat tautan",
    required: true,
    control: "url",
  },
  {
    key: "label",
    label: "Nama tautan",
    required: true,
    control: "text",
  },
];

/** Yang sengaja tidak ada: IITrack bukan penyimpan berkas. */
export const REFERENCE_FORM_EXCLUSIONS = [
  "fileUpload",
  "binaryStore",
  "copyOfFile",
] as const;

export function referenceKindLabel(kind: ReferenceKind): string {
  switch (kind) {
    case "GOOGLE_DRIVE":
      return "Drive";
    case "NOTION":
      return "Notion";
    case "GITHUB_REPO":
      return "GitHub";
    case "OTHER":
      return "Lainnya";
  }
}

export type ParsedReferenceForm = {
  projectDbId: string;
  url: string;
  label: string;
};

export type ReferenceFormParseResult =
  | { ok: true; data: ParsedReferenceForm }
  | { ok: false; reason: string; fields: Record<string, string> };

export function parseReferenceForm(input: {
  projectDbId: string;
  url: string;
  label: string;
}): ReferenceFormParseResult {
  const fields: Record<string, string> = {};

  const projectDbId = input.projectDbId.trim();
  if (projectDbId.length === 0) {
    fields.projectDbId = "Project yang dimaksud tidak ditemukan.";
  }

  const url = normalizeReferenceUrl(input.url.trim());
  if (!url) {
    fields.url =
      "Alamat tautan tidak sah. Pakai alamat lengkap yang diawali https://.";
  } else {
    const kind = classifyReferenceUrl(url);
    if (kind === "GITHUB_REPO" && !parseGithubRepo(url)) {
      fields.url =
        "Alamat GitHub itu bukan alamat sebuah repository. Pakai alamat berbentuk https://github.com/pemilik/repositori.";
    }
  }

  const label = input.label.trim();
  if (label.length === 0) {
    fields.label = "Beri nama tautannya supaya mudah dikenali di Project Hub.";
  }

  if (Object.keys(fields).length > 0 || !url) {
    return {
      ok: false,
      reason: "Tautan belum bisa disimpan karena ada isian yang belum lengkap.",
      fields,
    };
  }

  return { ok: true, data: { projectDbId, url, label } };
}

/**
 * Tombol tambah: Operational yang boleh edit, atau TechDev yang boleh edit.
 * Server tetap memilah jenis URL (Drive vs GitHub) menurut izinnya.
 */
export function canSeeAddReferenceForm(
  actor: Actor,
  project: ProjectContext,
  now: Date = new Date(),
): boolean {
  return (
    can({ actor, action: "project.edit_operational", project, now }) ||
    can({ actor, action: "techdev.edit", project, now })
  );
}
