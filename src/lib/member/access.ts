import { can } from "@/lib/auth/permissions";
import type { Action, Actor } from "@/lib/auth/types";

/**
 * Siapa yang boleh membaca daftar pengurus (F07).
 *
 * Berkas ini murni dan tidak menyentuh basis data, sesuai PRD bab 3.9, supaya
 * aturannya bisa diuji tanpa menyalakan apa pun.
 *
 * Syaratnya sengaja disamakan dengan menu Pengurus pada PLANNED_MAIN_NAV, yang
 * memang membuka daftar ini bagi seluruh pemegang master_data.view dan
 * menutupnya bagi anggota TechDev biasa (F03-T04). Yang dulu kurang bukan
 * kebijakannya, melainkan penegakannya: aturan itu hanya berlaku pada menu,
 * sedangkan permintaan langsung ke halamannya tetap dilayani beserta surel
 * seluruh pengurus dan penanda pemegang System Administrator privilege.
 */
export const MEMBER_LIST_ACTIONS: readonly Action[] = [
  "master_data.view",
  "member.manage",
];

export function canReadMemberList(
  actor: Actor,
  now: Date = new Date(),
): boolean {
  return MEMBER_LIST_ACTIONS.some((action) => can({ actor, action, now }));
}
