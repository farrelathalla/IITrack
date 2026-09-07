/**
 * Katalog aksi kritis yang wajib meninggalkan jejak (F24).
 *
 * Nama aksi dikumpulkan di satu berkas supaya laporan jejak aktivitas tidak
 * berisi ejaan yang berbeda-beda untuk kejadian yang sama, dan supaya test bisa
 * merujuk konstanta alih-alih menyalin teksnya.
 *
 * Setiap konstanta di sini wajib dipanggil lewat `recordAudit` dari proses
 * server yang bersangkutan. Test F24-AC2 memindai `src/server` supaya
 * penambahan aksi baru tidak bergantung pada ingatan penulis kode.
 *
 * Override gate (F10) dan penandaan P0 belum punya proses server, jadi belum
 * ada konstantanya. Saat fitur itu ditulis, tambah aksi di sini dan panggil
 * `recordAudit` dari prosesnya — test F24-AC2 akan gagal jika katalog
 * bertambah tanpa pemanggilan.
 */
export const AUDIT_ACTIONS = {
  AUTH_LOGIN_SUCCESS: "auth.login_success",
  AUTH_LOGIN_FAILED: "auth.login_failed",
  AUTH_LOGOUT: "auth.logout",
  SESSION_REVOKED_AUTOMATIC: "session.revoked_automatic",
  SESSION_REVOKED_BY_ADMIN: "session.revoked_by_admin",
  PROJECT_CREATED: "project.created",
  PROJECT_ID_OVERRIDDEN: "project.id_overridden",
  PROJECT_STAGE_CHANGED: "project.stage_changed",
  PROJECT_PM_ASSIGNED: "project.pm_assigned",
  MEMBER_ROLE_ASSIGNED: "member.role_assigned",
  MEMBER_ROLE_PERIOD_OVERRIDDEN: "member.role_period_overridden",
  MEMBER_HANDOVER: "member.handover",
  USER_DEACTIVATED: "user.deactivated",
  SUBMISSION_CREATED: "submission.created",
  SUBMISSION_STEP_APPROVED: "submission.step_approved",
  SUBMISSION_STEP_REJECTED: "submission.step_rejected",
  SUBMISSION_REVISED: "submission.revised",
  PROJECT_MEMBER_ASSIGNED: "project.member_assigned",
  PROJECT_MEMBER_UNASSIGNED: "project.member_unassigned",
  STAFFING_REQUESTED: "staffing.requested",
  STAFFING_FULFILLED: "staffing.fulfilled",
  REFERENCE_ADDED: "reference.added",
  TERMIN_SCHEME_SAVED: "termin.scheme_saved",
  INVOICE_REQUESTED: "invoice.requested",
  RECEIPT_RECORDED: "receipt.recorded",
  RECEIPT_VALIDATED: "receipt.validated",
  TERMIN_MARKED_PAID: "termin.marked_paid",
  CLIENT_CREATED: "client.created",
  CLIENT_UPDATED: "client.updated",
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_OBJECTS = {
  USER: "user",
  SESSION: "session",
  PROJECT: "project",
  SUBMISSION: "submission",
  STAFFING_REQUEST: "staffing_request",
  CLIENT: "client",
  INVOICE: "invoice",
  RECEIPT: "receipt",
  TERMIN: "termin",
} as const;

export type AuditObjectType =
  (typeof AUDIT_OBJECTS)[keyof typeof AUDIT_OBJECTS];
