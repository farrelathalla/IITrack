"use client";

import {
  createPeriodAction,
  saveToleranceAction,
} from "@/app/(internal)/settings/actions";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, InfoRow } from "@/components/ui/card";
import { TextField } from "@/components/ui/text-field";
import { useRunner } from "@/components/use-runner";

export interface PeriodView {
  id: string;
  name: string;
  code: string;
  start: string;
  end: string;
  status: "Aktif" | "Akan Datang" | "Berakhir";
}

/**
 * System (PRD bab 8.7): periode kepengurusan, pembuatan periode baru, format
 * Project ID, dan toleransi status final.
 */
export function SystemSection({
  periods,
  projectIdFormat,
  tolerance,
}: {
  periods: PeriodView[];
  projectIdFormat: string;
  tolerance: number;
}) {
  const period = useRunner();
  const tol = useRunner();
  const active = periods.find((p) => p.status === "Aktif");

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <h2 className="mb-3 font-bold text-ink text-sm">
          Periode Kepengurusan
        </h2>
        <div className="mb-4 rounded-lg border border-line px-4 py-1">
          <InfoRow label="Periode aktif">
            {active
              ? `${active.name} (${active.start} s.d. ${active.end})`
              : "Belum ada"}
          </InfoRow>
          <InfoRow label="Format Project ID">{projectIdFormat}</InfoRow>
          <InfoRow label="Contoh">
            {active ? `IIT-${active.code}-001` : "-"}
          </InfoRow>
        </div>
        <table className="mb-4 w-full text-xs">
          <thead className="text-left text-[10px] text-muted uppercase tracking-wider">
            <tr>
              <th className="pb-1">Periode</th>
              <th className="pb-1">Kode</th>
              <th className="pb-1">Mulai</th>
              <th className="pb-1">Berakhir</th>
              <th className="pb-1">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-surface">
            {periods.map((p) => (
              <tr key={p.id}>
                <td className="py-2 font-medium text-ink">{p.name}</td>
                <td className="py-2 font-mono">{p.code}</td>
                <td className="py-2">{p.start}</td>
                <td className="py-2">{p.end}</td>
                <td className="py-2">
                  <Badge
                    tone={
                      p.status === "Aktif"
                        ? "success"
                        : p.status === "Akan Datang"
                          ? "brand"
                          : "neutral"
                    }
                  >
                    {p.status}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <form
          action={(fd) =>
            period.run(() =>
              createPeriodAction({
                name: String(fd.get("name") ?? ""),
                startDate: String(fd.get("startDate") ?? ""),
                endDate: String(fd.get("endDate") ?? ""),
              }),
            )
          }
          className="space-y-3 rounded-lg bg-surface p-4"
        >
          <p className="font-semibold text-ink text-xs">Buat periode baru</p>
          {period.error ? <Alert tone="danger">{period.error}</Alert> : null}
          {period.message ? (
            <Alert tone="success">{period.message}</Alert>
          ) : null}
          <div className="grid grid-cols-3 gap-3">
            <TextField
              label="Nama periode"
              name="name"
              placeholder="2027/2028"
              required
            />
            <TextField
              label="Tanggal mulai (transisi)"
              name="startDate"
              type="date"
              required
            />
            <TextField
              label="Tanggal akhir"
              name="endDate"
              type="date"
              required
            />
          </div>
          <p className="text-[11px] text-subtle">
            Akses pengurus lama berakhir otomatis di tanggal akhir periode.
          </p>
          <Button type="submit" size="sm" disabled={period.pending}>
            Buat Periode
          </Button>
        </form>
      </Card>

      <Card className="p-5">
        <h2 className="mb-1 font-bold text-ink text-sm">
          Toleransi Status Final
        </h2>
        <p className="mb-3 text-muted text-xs">
          Selisih dari target yang masih dihitung tepat waktu.
        </p>
        {tol.error ? (
          <Alert tone="danger" className="mb-2">
            {tol.error}
          </Alert>
        ) : null}
        {tol.message ? (
          <Alert tone="success" className="mb-2">
            {tol.message}
          </Alert>
        ) : null}
        <form
          action={(fd) =>
            tol.run(() => saveToleranceAction(String(fd.get("days") ?? "")))
          }
          className="flex items-end gap-2"
        >
          <TextField
            label="Toleransi (hari)"
            name="days"
            type="number"
            min={0}
            max={90}
            defaultValue={tolerance}
            className="w-32"
          />
          <Button
            type="submit"
            size="sm"
            disabled={tol.pending}
            className="mb-0.5"
          >
            Simpan
          </Button>
        </form>
      </Card>
    </div>
  );
}
