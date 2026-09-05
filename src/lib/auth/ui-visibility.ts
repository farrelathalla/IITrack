import {
  type PlannedNavItem,
  plannedNavNow,
} from "@/lib/ui/project-hub-layout";
import { can } from "./permissions";
import type { Action, Actor } from "./types";

/**
 * Pintu tampilan F03-T04: menyembunyikan menu/tombol yang tidak boleh dipakai.
 *
 * Ini hanya pelengkap UX. Larangan sungguhan tetap di `checkPermission` /
 * `authorize` di server — menyembunyikan tautan tidak menggantikan itu.
 *
 * Susunan item nav mengikuti kontrak F08 (`plannedNavNow`).
 */

export type MainNavItem = {
  href: string;
  label: string;
  /** Aksi yang harus diizinkan agar item muncul. `null` = selalu tampil. */
  requires: Action | readonly Action[] | null;
};

function canAny(actor: Actor, actions: readonly Action[], now: Date): boolean {
  return actions.some((action) => can({ actor, action, now }));
}

/**
 * Apakah satu aksi (atau salah satu alternatif) boleh dipakai actor sekarang.
 * Bentuk ringkas untuk menyembunyikan tombol di halaman, bukan hanya nav.
 */
export function canSeeAction(
  actor: Actor,
  action: Action | readonly Action[],
  now: Date = new Date(),
): boolean {
  const actions = typeof action === "string" ? [action] : action;
  return canAny(actor, actions, now);
}

function navItemVisible(
  actor: Actor,
  item: PlannedNavItem,
  now: Date,
): boolean {
  if (item.requires === null) return true;
  if (typeof item.requires === "string") {
    return can({ actor, action: item.requires, now });
  }
  return canAny(actor, item.requires, now);
}

/**
 * Menu utama yang boleh ditampilkan untuk actor (hanya item `availability: now`).
 */
export function visibleMainNav(
  actor: Actor,
  now: Date = new Date(),
): MainNavItem[] {
  return plannedNavNow()
    .filter((item) => navItemVisible(actor, item, now))
    .map((item) => ({
      href: item.href,
      label: item.label,
      requires: item.requires,
    }));
}
