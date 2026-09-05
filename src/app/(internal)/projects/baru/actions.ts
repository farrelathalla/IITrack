"use server";

import { parseOptionalProjectValue } from "@/lib/project/registration-form";
import { getAuthenticatedSession } from "@/server/auth/session";
import { registerProject } from "@/server/project/registration";

export interface RegisterFormState {
  error: string | null;
  fields?: Record<string, string>;
  /** Terisi setelah pendaftaran berhasil — ditampilkan menonjol di UI. */
  projectId?: string;
}

const INITIAL_HINT =
  "Pendaftaran belum bisa disimpan karena ada isian yang belum lengkap. Nomor project belum diterbitkan.";

export async function registerProjectAction(
  _previous: RegisterFormState,
  formData: FormData,
): Promise<RegisterFormState> {
  const session = await getAuthenticatedSession();
  if (!session) {
    return {
      error:
        "Sesi Anda sudah berakhir. Silakan masuk kembali lalu daftar ulang.",
    };
  }

  const valueParsed = parseOptionalProjectValue(
    String(formData.get("value") ?? ""),
  );
  if (!valueParsed.ok) {
    return {
      error: INITIAL_HINT,
      fields: { value: valueParsed.message },
    };
  }

  const result = await registerProject({
    actor: session.actor,
    input: {
      name: String(formData.get("name") ?? ""),
      clientName: String(formData.get("clientName") ?? ""),
      period: String(formData.get("period") ?? ""),
      value: valueParsed.value,
    },
  });

  if (!result.registered) {
    return {
      error: result.reason,
      fields: result.fields,
    };
  }

  return {
    error: null,
    projectId: result.projectId,
  };
}
