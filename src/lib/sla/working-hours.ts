/**
 * Perhitungan lama waktu dalam jam kerja (F04, dipakai lagi oleh F15).
 *
 * Fungsi di sini murni dan tidak menyentuh basis data. Perhitungan hari kerja
 * mudah salah di ujung-ujungnya — akhir pekan, malam hari, waktu mulai di luar
 * jam kerja — jadi aturannya dikumpulkan di satu tempat dan diuji terpisah.
 */

export interface WorkingHoursConfig {
  /**
   * Selisih zona waktu terhadap UTC dalam menit. WIB bernilai 420.
   * Disimpan sebagai angka, bukan nama zona, supaya perhitungannya tidak
   * bergantung pada basis data zona waktu sistem yang menjalankannya.
   */
  offsetMinutes: number;
  /** Hari kerja, 0 berarti Minggu sampai 6 berarti Sabtu. */
  workDays: readonly number[];
  /** Menit ke berapa dalam sehari jam kerja dimulai. 09.00 bernilai 540. */
  startMinuteOfDay: number;
  /** Menit ke berapa dalam sehari jam kerja berakhir. 17.00 bernilai 1020. */
  endMinuteOfDay: number;
}

/**
 * Senin sampai Jumat, 09.00 sampai 17.00 WIB.
 *
 * PRD dan Project Charter menyebut "enam jam kerja" tanpa mendefinisikan hari
 * dan jamnya. Nilai di bawah adalah asumsi kerja yang masih perlu dikonfirmasi
 * COO; mengubahnya cukup di berkas ini dan tidak menyentuh kode pemakainya.
 */
export const DEFAULT_WORKING_HOURS: WorkingHoursConfig = {
  offsetMinutes: 7 * 60,
  workDays: [1, 2, 3, 4, 5],
  startMinuteOfDay: 9 * 60,
  endMinuteOfDay: 17 * 60,
};

/** Ambang SLA penugasan PM, yaitu enam jam kerja. */
export const SLA_PM_ASSIGNMENT_MINUTES = 6 * 60;

const MINUTES_PER_DAY = 24 * 60;
/** 1 Januari 1970 jatuh pada hari Kamis. */
const EPOCH_WEEKDAY = 4;

/** Menit sejak epoch menurut zona waktu setempat, bukan UTC. */
function localMinutes(instant: Date, config: WorkingHoursConfig): number {
  return Math.floor(instant.getTime() / 60_000) + config.offsetMinutes;
}

function weekdayOf(dayIndex: number): number {
  return (((dayIndex + EPOCH_WEEKDAY) % 7) + 7) % 7;
}

/**
 * Lama waktu antara dua saat, dihitung hanya pada jam kerja.
 *
 * Urutan terbalik menghasilkan nol, bukan angka negatif, supaya data yang
 * janggal tidak berubah menjadi SLA yang seolah-olah sangat baik.
 */
export function workingMinutesBetween(
  from: Date,
  to: Date,
  config: WorkingHoursConfig = DEFAULT_WORKING_HOURS,
): number {
  const start = localMinutes(from, config);
  const end = localMinutes(to, config);

  if (end <= start) return 0;

  const firstDay = Math.floor(start / MINUTES_PER_DAY);
  const lastDay = Math.floor((end - 1) / MINUTES_PER_DAY);

  let total = 0;

  for (let day = firstDay; day <= lastDay; day++) {
    if (!config.workDays.includes(weekdayOf(day))) continue;

    const dayStart = day * MINUTES_PER_DAY;
    const windowStart = dayStart + config.startMinuteOfDay;
    const windowEnd = dayStart + config.endMinuteOfDay;

    const overlapStart = Math.max(start, windowStart);
    const overlapEnd = Math.min(end, windowEnd);

    if (overlapEnd > overlapStart) {
      total += overlapEnd - overlapStart;
    }
  }

  return total;
}

export interface SlaEvaluation {
  workingMinutes: number;
  withinThreshold: boolean;
  /** Selisih lewat ambang, nol bila masih memenuhi. */
  overdueMinutes: number;
}

export function evaluateSla(
  from: Date,
  to: Date,
  thresholdMinutes: number,
  config: WorkingHoursConfig = DEFAULT_WORKING_HOURS,
): SlaEvaluation {
  const workingMinutes = workingMinutesBetween(from, to, config);

  return {
    workingMinutes,
    withinThreshold: workingMinutes <= thresholdMinutes,
    overdueMinutes: Math.max(0, workingMinutes - thresholdMinutes),
  };
}
