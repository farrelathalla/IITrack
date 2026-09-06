import { activeAssignments } from "@/lib/auth/period";
import type { Actor, Division, RoleName } from "@/lib/auth/types";

/**
 * Aturan siapa boleh menugaskan pelaksana ke sebuah project (F31).
 *
 * Murni, tidak menyentuh basis data. Dipisahkan supaya batas kewenangan antar
 * domain bisa diuji tanpa menyiapkan project maupun pengguna.
 */

/**
 * Divisi yang diperintah sebuah jabatan.
 *
 * Hanya C-Level dan wakilnya yang memerintah divisi. Jabatan lain mengembalikan
 * kosong, bukan divisi tempat ia bekerja, karena bekerja di sebuah divisi tidak
 * sama dengan berwenang menugaskan orang ke dalamnya.
 */
export function divisionGovernedBy(role: RoleName): Division | null {
  switch (role) {
    case "COO":
    case "VICE_COO":
      return "OPERATIONAL";
    case "CFO":
    case "VICE_CFO":
      return "FINANCE";
    case "CTO":
    case "VICE_CTO":
      return "TECHDEV";
    default:
      return null;
  }
}

/**
 * Apakah seseorang boleh menugaskan pelaksana ke sebuah divisi.
 *
 * Pilihan lintas domain ditolak: COO tidak bisa menugaskan pelaksana Finance,
 * dan sebaliknya. Yang memegang dua jabatan C-Level berwenang di kedua
 * domainnya.
 */
export function canAssignToDivision(
  candidate: Actor,
  division: Division,
  now: Date,
): boolean {
  if (candidate.status !== "ACTIVE") return false;

  return activeAssignments(candidate.roleAssignments, now).some(
    (assignment) => divisionGovernedBy(assignment.role) === division,
  );
}
