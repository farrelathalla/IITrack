/**
 * Katalog aksi kritis yang wajib meninggalkan jejak (F24).
 *
 * Nama aksi dikumpulkan di satu berkas supaya laporan jejak aktivitas tidak
 * berisi ejaan yang berbeda-beda untuk kejadian yang sama, dan supaya test bisa
 * merujuk konstanta alih-alih menyalin teksnya.
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
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

export const AUDIT_OBJECTS = {
  USER: "user",
  SESSION: "session",
  PROJECT: "project",
} as const;

export type AuditObjectType =
  (typeof AUDIT_OBJECTS)[keyof typeof AUDIT_OBJECTS];
