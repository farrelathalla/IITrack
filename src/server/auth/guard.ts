import { checkPermission } from "@/lib/auth/permissions";
import type { Action, Actor, ProjectContext } from "@/lib/auth/types";

/**
 * Ditolaknya sebuah aksi karena wewenang. Pesannya sudah berbahasa pengguna dan
 * boleh ditampilkan apa adanya (PRD bab 5, Kemudahan Penggunaan).
 */
export class PermissionDeniedError extends Error {
  readonly action: Action;

  constructor(action: Action, reason: string) {
    super(reason);
    this.name = "PermissionDeniedError";
    this.action = action;
  }
}

export interface AuthorizeInput {
  actor: Actor;
  action: Action;
  project?: ProjectContext;
  now?: Date;
}

/**
 * Penjaga izin sisi server. Setiap route handler dan server action memanggil ini
 * sebelum menyentuh data, sehingga permintaan yang tidak lewat tampilan tetap
 * ditolak (PRD bab 5, Keamanan Akses).
 */
export function authorize(input: AuthorizeInput): void {
  const decision = checkPermission({
    actor: input.actor,
    action: input.action,
    project: input.project,
    now: input.now ?? new Date(),
  });

  if (!decision.allowed) {
    throw new PermissionDeniedError(input.action, decision.reason);
  }
}

/** Menerjemahkan penolakan izin menjadi respons HTTP 403 beserta alasannya. */
export function permissionDeniedResponse(
  error: PermissionDeniedError,
): Response {
  return Response.json({ error: error.message }, { status: 403 });
}
