import { describe, expect, it } from "vitest";
import type { WorkingHoursConfig } from "@/lib/sla/working-hours";
import {
  DEFAULT_WORKING_HOURS,
  evaluateSla,
  SLA_PM_ASSIGNMENT_MINUTES,
  workingMinutesBetween,
} from "@/lib/sla/working-hours";

/** Senin sampai Jumat, 09.00 sampai 17.00 WIB. */
const KONFIG: WorkingHoursConfig = DEFAULT_WORKING_HOURS;

/** Membantu menulis waktu WIB tanpa menghitung offset di setiap baris. */
function wib(iso: string): Date {
  return new Date(`${iso}+07:00`);
}

describe("F04-AC1 Sistem menstempel waktu konfirmasi client dan waktu penugasan PM, lalu menghitung selisihnya terhadap ambang enam jam kerja.", () => {
  it("Selisih di dalam satu hari kerja dihitung apa adanya", () => {
    // Selasa 1 September 2026, 09.00 sampai 12.00.
    const menit = workingMinutesBetween(
      wib("2026-09-01T09:00:00"),
      wib("2026-09-01T12:00:00"),
      KONFIG,
    );

    expect(menit).toBe(180);
  });

  it("Waktu di luar jam kerja tidak dihitung", () => {
    // Mulai pukul 07.00, sebelum jam kerja. Yang dihitung baru sejak 09.00.
    const menit = workingMinutesBetween(
      wib("2026-09-01T07:00:00"),
      wib("2026-09-01T11:00:00"),
      KONFIG,
    );

    expect(menit).toBe(120);
  });

  it("Malam hari tidak dihitung, sehingga selisih menyeberang ke hari berikutnya", () => {
    // Selasa 16.00 sampai Rabu 10.00. Yang dihitung: 16.00-17.00 lalu 09.00-10.00.
    const menit = workingMinutesBetween(
      wib("2026-09-01T16:00:00"),
      wib("2026-09-02T10:00:00"),
      KONFIG,
    );

    expect(menit).toBe(120);
  });

  it("Akhir pekan tidak dihitung sebagai jam kerja", () => {
    // Jumat 4 September 16.00 sampai Senin 7 September 10.00.
    // Yang dihitung: Jumat 16.00-17.00 lalu Senin 09.00-10.00.
    const menit = workingMinutesBetween(
      wib("2026-09-04T16:00:00"),
      wib("2026-09-07T10:00:00"),
      KONFIG,
    );

    expect(menit).toBe(120);
  });

  it("Satu hari kerja penuh bernilai delapan jam", () => {
    const menit = workingMinutesBetween(
      wib("2026-09-01T09:00:00"),
      wib("2026-09-02T09:00:00"),
      KONFIG,
    );

    expect(menit).toBe(480);
  });

  it("Selisih nol bila keduanya berada di luar jam kerja pada hari yang sama", () => {
    const menit = workingMinutesBetween(
      wib("2026-09-05T10:00:00"),
      wib("2026-09-06T14:00:00"),
      KONFIG,
    );

    expect(menit).toBe(0);
  });

  it("Urutan terbalik menghasilkan nol, bukan angka negatif", () => {
    const menit = workingMinutesBetween(
      wib("2026-09-02T10:00:00"),
      wib("2026-09-01T10:00:00"),
      KONFIG,
    );

    expect(menit).toBe(0);
  });

  it("Ambang SLA penugasan PM adalah enam jam kerja", () => {
    expect(SLA_PM_ASSIGNMENT_MINUTES).toBe(360);
  });

  it("Penugasan dalam enam jam kerja dinilai memenuhi SLA", () => {
    const hasil = evaluateSla(
      wib("2026-09-01T09:00:00"),
      wib("2026-09-01T14:00:00"),
      SLA_PM_ASSIGNMENT_MINUTES,
      KONFIG,
    );

    expect(hasil.workingMinutes).toBe(300);
    expect(hasil.withinThreshold).toBe(true);
    expect(hasil.overdueMinutes).toBe(0);
  });

  it("Penugasan tepat pada ambang masih dinilai memenuhi SLA", () => {
    const hasil = evaluateSla(
      wib("2026-09-01T09:00:00"),
      wib("2026-09-01T15:00:00"),
      SLA_PM_ASSIGNMENT_MINUTES,
      KONFIG,
    );

    expect(hasil.workingMinutes).toBe(360);
    expect(hasil.withinThreshold).toBe(true);
  });

  it("Penugasan yang melewati ambang dinilai melanggar beserta selisih lewatnya", () => {
    // Selasa 09.00 sampai Rabu 10.00 = 480 + 60 = 540 menit kerja.
    const hasil = evaluateSla(
      wib("2026-09-01T09:00:00"),
      wib("2026-09-02T10:00:00"),
      SLA_PM_ASSIGNMENT_MINUTES,
      KONFIG,
    );

    expect(hasil.workingMinutes).toBe(540);
    expect(hasil.withinThreshold).toBe(false);
    expect(hasil.overdueMinutes).toBe(180);
  });

  it("Akhir pekan tidak membuat penugasan dinilai melanggar SLA", () => {
    // Jumat 15.00 sampai Senin 11.00: Jumat 2 jam, Senin 2 jam, total 4 jam.
    const hasil = evaluateSla(
      wib("2026-09-04T15:00:00"),
      wib("2026-09-07T11:00:00"),
      SLA_PM_ASSIGNMENT_MINUTES,
      KONFIG,
    );

    expect(hasil.workingMinutes).toBe(240);
    expect(hasil.withinThreshold).toBe(true);
  });
});
