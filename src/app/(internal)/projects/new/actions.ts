"use server";

import { revalidatePath } from "next/cache";
import { requireActionUser } from "@/server/auth/current";
import { createProject } from "@/server/project/create";
import { ActionError } from "@/server/project/mutate";
import {
  type CreateProjectFormValues,
  createProjectFormValues,
} from "./form-values";

export type CreateProjectState =
  | { status: "idle" }
  | {
      status: "error";
      error: string;
      fields?: Record<string, string>;
      values: CreateProjectFormValues;
      resetKey: string;
    }
  | { status: "created"; code: string; pmName: string };

export async function createProjectAction(
  _previous: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const values = createProjectFormValues(formData);
  try {
    const { actor } = await requireActionUser();
    const result = await createProject({
      actor,
      input: {
        name: values.name,
        client: values.client,
        type: values.type,
        source: values.source,
        pmUserId: values.pmUserId,
        targetStart: values.targetStart,
        targetEnd: values.targetEnd,
        internalNote: values.internalNote,
        manualCode: values.manualCode,
      },
    });
    // Segarkan halaman tujuan tanpa membangun ulang layout/form yang
    // masih menyelesaikan transisi useActionState.
    revalidatePath("/");
    revalidatePath("/projects");
    revalidatePath("/projects/all");
    return { status: "created", ...result };
  } catch (error) {
    if (error instanceof ActionError) {
      return {
        status: "error",
        error: error.message,
        fields: error.fields,
        values,
        resetKey: crypto.randomUUID(),
      };
    }
    throw error;
  }
}
