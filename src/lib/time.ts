/**
 * Waktu disimpan dalam UTC dan ditampilkan dalam WIB (PRD bab 13).
 *
 * Tanggal tanpa jam (due date, target selesai) dibaca sebagai tengah malam WIB
 * pada tanggal itu, sehingga "25 Sep" berarti 25 Sep di Jakarta, bukan di UTC.
 */

export const TIME_ZONE = "Asia/Jakarta";
const WIB_OFFSET = "+07:00";
const DAY_MS = 24 * 60 * 60 * 1000;

/** "2026-09-25" → Date pada 2026-09-25 00:00 WIB. `null` bila tidak valid. */
export function parseDateInput(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const date = new Date(`${trimmed}T00:00:00${WIB_OFFSET}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

/** Date → "2026-09-25" menurut kalender WIB, untuk nilai `<input type=date>`. */
export function toDateInput(date: Date | null | undefined): string {
  if (!date) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** Nomor hari kalender WIB, untuk membandingkan tanggal tanpa jam. */
export function wibDayNumber(date: Date): number {
  const [y, m, d] = toDateInput(date).split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

/** Selisih hari kalender WIB: positif bila `target` di masa depan. */
export function daysUntil(target: Date, now: Date): number {
  return wibDayNumber(target) - wibDayNumber(now);
}

export function isPastDay(target: Date, now: Date): boolean {
  return daysUntil(target, now) < 0;
}

const MONTHS_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "Mei",
  "Jun",
  "Jul",
  "Agu",
  "Sep",
  "Okt",
  "Nov",
  "Des",
];

const DAYS = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];

function wibParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const weekdayIndex = [
    "Sun",
    "Mon",
    "Tue",
    "Wed",
    "Thu",
    "Fri",
    "Sat",
  ].indexOf(get("weekday"));
  return {
    year: Number(get("year")),
    month: Number(get("month")) - 1,
    day: Number(get("day")),
    hour: get("hour") === "24" ? "00" : get("hour"),
    minute: get("minute"),
    weekday: weekdayIndex,
  };
}

/** "22 Sep 2026" */
export function formatDate(date: Date | null | undefined): string {
  if (!date) return "-";
  const p = wibParts(date);
  return `${p.day} ${MONTHS_SHORT[p.month]} ${p.year}`;
}

/** "22 Sep" */
export function formatDayMonth(date: Date): string {
  const p = wibParts(date);
  return `${p.day} ${MONTHS_SHORT[p.month]}`;
}

/** "22 SEP" untuk kolom tanggal Deadline Terdekat. */
export function formatDayMonthUpper(date: Date): string {
  return formatDayMonth(date).toUpperCase();
}

/** "18 Sep · 16:20" */
export function formatDateTimeShort(date: Date): string {
  const p = wibParts(date);
  return `${p.day} ${MONTHS_SHORT[p.month]} · ${p.hour}:${p.minute}`;
}

/** "18 Sep 2026, 16:20 WIB" */
export function formatDateTime(date: Date): string {
  const p = wibParts(date);
  return `${p.day} ${MONTHS_SHORT[p.month]} ${p.year}, ${p.hour}:${p.minute} WIB`;
}

/** "22 Sep 2026, Senin" seperti sudut kanan atas Dashboard. */
export function formatToday(date: Date): string {
  const p = wibParts(date);
  return `${p.day} ${MONTHS_SHORT[p.month]} ${p.year}, ${DAYS[p.weekday]}`;
}

export function yearInWib(date: Date): number {
  return wibParts(date).year;
}
