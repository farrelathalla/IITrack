/**
 * Tautan ke berkas dan repository di luar IITrack (F25).
 *
 * IITrack tidak menyalin isi berkasnya, hanya menyimpan alamatnya bersama
 * Project ID. Berkas ini murni: pengenalan jenis dan pemeriksaan bentuk alamat
 * tidak menyentuh jaringan maupun basis data.
 */

export type ReferenceKind = "GOOGLE_DRIVE" | "NOTION" | "GITHUB_REPO" | "OTHER";

const HOST_KIND: Array<{
  matches: (host: string) => boolean;
  kind: ReferenceKind;
}> = [
  {
    matches: (host) =>
      host === "drive.google.com" || host === "docs.google.com",
    kind: "GOOGLE_DRIVE",
  },
  {
    matches: (host) =>
      host === "notion.so" ||
      host.endsWith(".notion.so") ||
      host.endsWith(".notion.site"),
    kind: "NOTION",
  },
  {
    matches: (host) => host === "github.com" || host === "www.github.com",
    kind: "GITHUB_REPO",
  },
];

/**
 * Mengurai alamat, atau `null` bila bentuknya tidak sah.
 *
 * Hanya https yang diterima. Tautan http biasa ditolak karena alamat yang
 * disimpan akan dibuka orang lain dari Project Hub.
 */
function safeUrl(value: string): URL | null {
  try {
    const url = new URL(value);
    return url.protocol === "https:" ? url : null;
  } catch {
    return null;
  }
}

/** Jenis rujukan menurut hostnya, atau `null` bila alamatnya tidak sah. */
export function classifyReferenceUrl(value: string): ReferenceKind | null {
  const url = safeUrl(value);
  if (!url) return null;

  const host = url.hostname.toLowerCase();
  return HOST_KIND.find((entry) => entry.matches(host))?.kind ?? "OTHER";
}

export interface GithubRepo {
  owner: string;
  repo: string;
}

/**
 * Pemilik dan nama repository dari sebuah alamat GitHub.
 *
 * Mengembalikan kosong untuk alamat GitHub yang bukan repository, misalnya
 * halaman organisasi, supaya tautan repository yang tersimpan benar-benar
 * menunjuk sebuah repository.
 */
export function parseGithubRepo(value: string): GithubRepo | null {
  const url = safeUrl(value);
  if (!url) return null;

  const host = url.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") return null;

  const segments = url.pathname
    .split("/")
    .filter((segment) => segment.length > 0);
  if (segments.length < 2) return null;

  const [owner, repoRaw] = segments;
  const repo = repoRaw.replace(/\.git$/, "");
  if (repo.length === 0) return null;

  return { owner, repo };
}

/**
 * Bentuk baku sebuah alamat.
 *
 * Host dijadikan huruf kecil, garis miring penutup dibuang, dan bagian setelah
 * tanda pagar dihilangkan karena tidak mengubah resource yang dibuka. Tanpa
 * pembakuan ini, satu berkas yang sama bisa tersimpan beberapa kali hanya
 * karena beda cara menuliskannya.
 */
export function normalizeReferenceUrl(value: string): string | null {
  const url = safeUrl(value);
  if (!url) return null;

  url.hash = "";
  url.hostname = url.hostname.toLowerCase();

  if (url.pathname.length > 1 && url.pathname.endsWith("/")) {
    url.pathname = url.pathname.replace(/\/+$/, "");
  }

  return url.toString();
}
