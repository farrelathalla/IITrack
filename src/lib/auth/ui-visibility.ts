import { can } from "./permissions";
import type { Action, Actor } from "./types";

/**
 * Pintu tampilan F03-T04: menyembunyikan menu/tombol yang tidak boleh dipakai.
 *
 * Ini hanya pelengkap UX. Larangan sungguhan tetap di `checkPermission` /
 * `authorize` di server — menyembunyikan tautan tidak menggantikan itu.
 */

export type MainNavItem = {
  href: string;
  label: string;
  /** Aksi yang harus diizinkan agar item muncul. `null` = selalu tampil. */
  requires: Action | null;
};

/** Menu utama yang dipakai layout internal saat ini. */
export const MAIN_NAV_ITEMS: readonly MainNavItem[] = [
  { href: "/beranda", label: "Beranda", requires: null },
  {
    href: "/projects/baru",
    label: "Daftarkan project",
    requires: "project.create",
  },
  {
    href: "/pengurus",
    label: "Pengurus",
    // Daftar bisa dibaca oleh pemilik master_data.view; System Admin tanpa
    // baseline view tetap masuk lewat member.manage (lihat visibleMainNav).
    requires: "master_data.view",
  },
] as const;

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

/**
 * Menu utama yang boleh ditampilkan untuk actor. Item Pengurus juga muncul
 * bila actor punya `member.manage` (System Admin tanpa `master_data.view`).
 */
export function visibleMainNav(
  actor: Actor,
  now: Date = new Date(),
): MainNavItem[] {
  return MAIN_NAV_ITEMS.filter((item) => {
    if (item.requires === null) return true;
    if (item.href === "/pengurus") {
      return canAny(actor, ["master_data.view", "member.manage"], now);
    }
    return can({ actor, action: item.requires, now });
  });
}
