/** Nama field formulir Tambah Project, dipakai ulang setelah error validasi. */
export const CREATE_PROJECT_FIELDS = [
  "name",
  "client",
  "type",
  "source",
  "pmUserId",
  "targetStart",
  "targetEnd",
  "internalNote",
  "manualCode",
] as const;

export type CreateProjectFormValues = Record<
  (typeof CREATE_PROJECT_FIELDS)[number],
  string
>;

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

/** Salinan isian yang dikirim, supaya error tidak mengosongkan formulir. */
export function createProjectFormValues(
  formData: FormData,
): CreateProjectFormValues {
  return {
    name: text(formData, "name"),
    client: text(formData, "client"),
    type: text(formData, "type"),
    source: text(formData, "source"),
    pmUserId: text(formData, "pmUserId"),
    targetStart: text(formData, "targetStart"),
    targetEnd: text(formData, "targetEnd"),
    internalNote: text(formData, "internalNote"),
    manualCode: text(formData, "manualCode"),
  };
}
