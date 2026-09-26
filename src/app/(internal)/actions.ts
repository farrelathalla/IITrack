"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireActionUser } from "@/server/auth/current";
import { markAllRead, markRead } from "@/server/notifications";
import { searchProjects } from "@/server/project/queries";

export interface SearchHit {
  code: string;
  name: string;
  client: string;
  closed: boolean;
}

/** Pencarian top bar: Project ID, nama project, dan nama client (PRD bab 3). */
export async function searchAction(query: string): Promise<SearchHit[]> {
  await requireActionUser();
  const rows = await searchProjects(query);
  return rows.map((row) => ({
    code: row.code,
    name: row.name,
    client: row.client,
    closed: row.closedAt !== null,
  }));
}

/**
 * Klik notifikasi membuka project pada stage dan tab yang relevan, lalu
 * menandainya sudah dibaca (PRD bab 8.6).
 */
export async function openNotificationAction(id: string): Promise<void> {
  const { actor } = await requireActionUser();
  const href = await markRead(actor.userId, id);
  revalidatePath("/", "layout");
  redirect(href ?? "/notifications");
}

export async function markAllReadAction(): Promise<void> {
  const { actor } = await requireActionUser();
  await markAllRead(actor.userId);
  revalidatePath("/", "layout");
}
