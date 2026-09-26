import { redirect } from "next/navigation";
import type { Viewer } from "@/lib/auth/access";
import type { Actor } from "@/lib/auth/types";
import { viewerOf } from "@/server/auth/actor";
import { inspectSession } from "@/server/auth/session";
import { ActionError } from "@/server/project/mutate";

export interface CurrentUser {
  actor: Actor;
  viewer: Viewer;
}

/**
 * Pengguna yang sedang masuk, untuk halaman. Sesi yang tidak sah langsung
 * diarahkan ke halaman masuk beserta alasannya.
 */
export async function requireUser(): Promise<CurrentUser> {
  const inspection = await inspectSession();
  if (inspection.kind === "anonymous") redirect("/login");
  if (inspection.kind === "ended") {
    redirect(`/login?alasan=${inspection.alasan}`);
  }
  const actor = inspection.session.actor;
  return { actor, viewer: viewerOf(actor) };
}

/**
 * Pengguna yang sedang masuk, untuk Server Action. Tidak me-redirect, supaya
 * penolakan bisa dikembalikan sebagai pesan ke formulir.
 */
export async function requireActionUser(): Promise<CurrentUser> {
  const inspection = await inspectSession();
  if (inspection.kind !== "authenticated") {
    throw new ActionError(
      "Sesi Anda sudah berakhir. Muat ulang halaman lalu masuk kembali.",
    );
  }
  const actor = inspection.session.actor;
  return { actor, viewer: viewerOf(actor) };
}
