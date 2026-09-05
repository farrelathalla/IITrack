/**
 * Kontrak tata letak F08 (hasil wireframe F08-T02 / #51).
 *
 * Modul ini sengaja murni (tanpa React/Prisma) supaya #50 mengimplementasikan
 * halaman tanpa mengubah susunan section di tengah jalan. Perubahan layout
 * harus lewat review dokumen `docs/wireframes/F08-project-hub.md` dulu.
 */

import type { Action } from "@/lib/auth/types";

/** Item menu utama yang disepakati untuk fase Project Hub. */
export type PlannedNavKey =
  | "beranda"
  | "project"
  | "pengurus"
  | "finance_queue";

export interface PlannedNavItem {
  key: PlannedNavKey;
  /** Label yang dibaca pengguna. */
  label: string;
  /** Rute target saat diimplementasikan. */
  href: string;
  /**
   * Aksi yang dibutuhkan agar item muncul.
   * `null` = selalu tampil untuk pengguna yang sudah masuk.
   * Array = cukup salah satu (OR), sama seperti pola Pengurus di F03-T04.
   */
  requires: Action | readonly Action[] | null;
  /**
   * `now` = sudah ada / segera di #50.
   * `later` = slot menu yang disiapkan, belum diisi sampai fitur siap.
   */
  availability: "now" | "later";
  note?: string;
}

/**
 * Susunan menu utama yang dikunci wireframe.
 *
 * "Daftarkan project" **bukan** item nav permanen: ia menjadi tombol di daftar
 * Project (`project.create`) supaya nav tidak memanjang tiap ada aksi baru.
 */
export const PLANNED_MAIN_NAV: readonly PlannedNavItem[] = [
  {
    key: "beranda",
    label: "Beranda",
    href: "/beranda",
    requires: null,
    availability: "now",
  },
  {
    key: "project",
    label: "Project",
    href: "/projects",
    requires: "project.view",
    availability: "now",
    note: "Daftar project (F08). Hub detail di /projects/[projectId].",
  },
  {
    key: "pengurus",
    label: "Pengurus",
    href: "/pengurus",
    requires: ["master_data.view", "member.manage"],
    availability: "now",
  },
  {
    key: "finance_queue",
    label: "Antrean Finance",
    href: "/finance/antrean",
    requires: "finance.view",
    availability: "later",
    note: "Muncul setelah F15; slot sudah dipesan agar nav tidak digeser ulang.",
  },
] as const;

/** Kolom daftar project (UAT-HUB-002). */
export type ProjectListColumnKey =
  | "projectId"
  | "name"
  | "client"
  | "pm"
  | "stage"
  | "updatedAt"
  | "value";

export interface ProjectListColumn {
  key: ProjectListColumnKey;
  label: string;
  /** Bila diisi, kolom hanya dirender bila `can(action)`. */
  requires?: Action;
}

export const PROJECT_LIST_COLUMNS: readonly ProjectListColumn[] = [
  { key: "projectId", label: "Project ID" },
  { key: "name", label: "Nama" },
  { key: "client", label: "Client" },
  { key: "pm", label: "PM" },
  { key: "stage", label: "Tahap" },
  { key: "updatedAt", label: "Terakhir diubah" },
  { key: "value", label: "Nilai", requires: "project.view_value" },
] as const;

/** Section pada satu layar hub detail (F08-T01 / UAT-HUB-003). */
export type HubSectionKey =
  | "identity"
  | "stage"
  | "pending"
  | "team"
  | "documents"
  | "termin"
  | "history";

export interface HubSection {
  key: HubSectionKey;
  title: string;
  /** Urutan visual dari atas ke bawah (1 = paling atas). */
  order: number;
  /**
   * Zona layout:
   * - `full` = lebar penuh
   * - `left` / `right` = pasangan dua kolom pada baris yang sama (`row`)
   */
  zone: "full" | "left" | "right";
  /** Pasangan kolom berbagi nomor `row` yang sama. */
  row?: number;
  summary: string;
}

/**
 * Satu layar, di-scroll vertikal — bukan tab per modul.
 * PRD wireframe 3.4.1 + acceptance F08: identitas, tahap, dokumen, termin,
 * tim, riwayat (+ pending action dari UAT-HUB-003).
 */
export const HUB_SECTIONS: readonly HubSection[] = [
  {
    key: "identity",
    title: "Identitas project",
    order: 1,
    zone: "full",
    summary:
      "Project ID, nama, client, periode, status aktif, nilai (bila diizinkan).",
  },
  {
    key: "stage",
    title: "Tahap berjalan",
    order: 2,
    zone: "full",
    summary:
      "Penanda tahap sekarang + tombol ajukan perpindahan (F09) bila berwenang.",
  },
  {
    key: "pending",
    title: "Tindakan menunggu",
    order: 3,
    zone: "full",
    summary:
      "Daftar aksi terbuka (override gate, approval, dll.). Kosong bila tidak ada.",
  },
  {
    key: "team",
    title: "Tim & penugasan",
    order: 4,
    zone: "left",
    row: 1,
    summary: "PM / Operational, Finance POC, TechDev PIC, tautan repo (F25).",
  },
  {
    key: "documents",
    title: "Dokumen & tautan",
    order: 5,
    zone: "right",
    row: 1,
    summary:
      "Status dokumen inti + tautan Drive/Notion/GitHub. Generate template = Should Have.",
  },
  {
    key: "termin",
    title: "Termin & pembayaran",
    order: 6,
    zone: "left",
    row: 2,
    summary: "Skema termin, status lunas/draft, pintu ke invoice/kuitansi.",
  },
  {
    key: "history",
    title: "Riwayat aktivitas",
    order: 7,
    zone: "right",
    row: 2,
    summary: "Jejak mudah dibaca (F24), bukan tabel mentah admin.",
  },
] as const;

export function hubSectionsInOrder(): HubSection[] {
  return [...HUB_SECTIONS].sort((a, b) => a.order - b.order);
}

export function plannedNavNow(): PlannedNavItem[] {
  return PLANNED_MAIN_NAV.filter((item) => item.availability === "now");
}
