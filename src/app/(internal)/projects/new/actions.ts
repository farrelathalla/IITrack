"use server";

import { revalidatePath } from "next/cache";
import { requireActionUser } from "@/server/auth/current";
import { createProject } from "@/server/project/create";
import { ActionError } from "@/server/project/mutate";

export type CreateProjectState =
  | { status: "idle" }
  | { status: "error"; error: string; fields?: Record<string, string> }
  | { status: "created"; code: string; pmName: string };

function text(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value : "";
}

export async function createProjectAction(
  _previous: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  try {
    const { actor } = await requireActionUser();
    const result = await createProject({
      actor,
      input: {
        name: text(formData, "name"),
        client: text(formData, "client"),
        type: text(formData, "type"),
        source: text(formData, "source"),
        pmUserId: text(formData, "pmUserId"),
        targetStart: text(formData, "targetStart"),
        targetEnd: text(formData, "targetEnd"),
        internalNote: text(formData, "internalNote"),
      },
    });
    revalidatePath("/", "layout");
    return { status: "created", ...result };
  } catch (error) {
    if (error instanceof ActionError) {
      return { status: "error", error: error.message, fields: error.fields };
    }
    throw error;
  }
}
