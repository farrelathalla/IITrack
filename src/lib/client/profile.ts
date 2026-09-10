/**
 * Pemeriksa isian master data client (F06).
 *
 * Nama wajib. Kontak, alamat, dan NPWP boleh kosong. NPWP yang diisi harus
 * bisa dibaca sebagai 15 atau 16 digit, termasuk kalau penulisnya memakai
 * titik dan strip format resmi.
 */

export interface ClientDraft {
  name: string;
  contact?: string | null;
  address?: string | null;
  npwp?: string | null;
}

export interface NormalizedClient {
  name: string;
  contact: string | null;
  address: string | null;
  npwp: string | null;
}

export type ClientValidation =
  | { valid: true; value: NormalizedClient }
  | { valid: false; reason: string };

function invalid(reason: string): ClientValidation {
  return { valid: false, reason };
}

function kosongKeNull(raw: string | null | undefined): string | null {
  if (raw === null || raw === undefined) return null;
  const teks = raw.trim();
  return teks.length === 0 ? null : teks;
}

/** NPWP 15 atau 16 digit, mengabaikan titik, strip, dan spasi. */
export function normalizeNpwp(raw: string | null | undefined):
  | {
      ok: true;
      value: string | null;
    }
  | { ok: false } {
  const teks = kosongKeNull(raw);
  if (teks === null) return { ok: true, value: null };

  const digit = teks.replace(/[.\s-]/g, "");
  if (!/^\d{15,16}$/.test(digit)) return { ok: false };
  return { ok: true, value: digit };
}

export function normalizeClientDraft(draft: ClientDraft): ClientValidation {
  const name = draft.name.trim();
  if (name.length === 0) {
    return invalid("Nama client wajib diisi.");
  }
  if (name.length > 200) {
    return invalid("Nama client terlalu panjang. Ringkas sampai 200 karakter.");
  }

  const contact = kosongKeNull(draft.contact);
  const address = kosongKeNull(draft.address);
  if (contact && contact.length > 200) {
    return invalid("Kontak client terlalu panjang.");
  }
  if (address && address.length > 500) {
    return invalid("Alamat client terlalu panjang.");
  }

  const npwp = normalizeNpwp(draft.npwp);
  if (!npwp.ok) {
    return invalid(
      "NPWP harus 15 atau 16 digit. Titik dan strip boleh dipakai, huruf tidak.",
    );
  }

  return {
    valid: true,
    value: { name, contact, address, npwp: npwp.value },
  };
}

export function clientDraftsEqual(
  a: NormalizedClient,
  b: NormalizedClient,
): boolean {
  return (
    a.name === b.name &&
    a.contact === b.contact &&
    a.address === b.address &&
    a.npwp === b.npwp
  );
}

/**
 * NPWP 15 digit memakai format resmi DJP. 16 digit (NIK sebagai NPWP)
 * ditampilkan utuh tanpa titik, karena pecahan resminya belum dipakai di sini.
 */
export function formatNpwpDisplay(npwp: string | null | undefined): string {
  if (!npwp) return "—";
  if (npwp.length === 15) {
    return `${npwp.slice(0, 2)}.${npwp.slice(2, 5)}.${npwp.slice(5, 8)}.${npwp.slice(8, 9)}-${npwp.slice(9, 12)}.${npwp.slice(12)}`;
  }
  return npwp;
}
