import {
  Alert,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { formatProjectValue } from "@/lib/project/hub-display";
import { toDateInputValue } from "@/lib/termin/live";
import { TerminSchemeForm } from "./termin-form";

type TerminRow = {
  sequence: number;
  percentage: string;
  amount: string;
  dueDate: Date;
  status: string;
};

function formatDueDate(value: Date): string {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: "Asia/Jakarta",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(value);
}

function statusLabel(status: string): string {
  return status === "PAID" ? "Lunas" : "Belum lunas";
}

export function TerminPanel({
  projectDbId,
  schemeValue,
  displayValue,
  termins,
  canEdit,
}: {
  projectDbId: string;
  schemeValue: string | null;
  displayValue: string | null;
  termins: TerminRow[];
  canEdit: boolean;
}) {
  const nilaiTampil = formatProjectValue(
    displayValue ?? (canEdit ? schemeValue : null),
  );
  const adaYangLunas = termins.some((row) => row.status === "PAID");
  const nilaiAda = schemeValue !== null && schemeValue !== "";

  return (
    <section
      id="termin"
      className="flex flex-col gap-3 rounded-card border border-line bg-white p-5"
    >
      <h2 className="text-base">Termin & pembayaran</h2>
      {nilaiTampil ? (
        <p className="text-sm">
          Nilai project:{" "}
          <span className="angka font-medium">{nilaiTampil}</span>
        </p>
      ) : null}

      {!nilaiAda ? (
        <Alert tone="status">
          Nilai project belum diisi, jadi skema termin belum bisa dihitung
          maupun disimpan.
        </Alert>
      ) : null}

      {adaYangLunas ? (
        <Alert tone="status">
          Ada termin yang sudah lunas, jadi jadwal tidak bisa disusun ulang dari
          sini. Perubahan setelah pelunasan mengikuti proses kuitansi.
        </Alert>
      ) : null}

      {termins.length > 0 && (!canEdit || adaYangLunas || !nilaiAda) ? (
        <TerminTable termins={termins} />
      ) : null}

      {termins.length === 0 && !canEdit ? (
        <p className="text-slate-500 text-sm">Belum ada jadwal termin.</p>
      ) : null}

      {canEdit && nilaiAda && !adaYangLunas ? (
        <TerminSchemeForm
          projectDbId={projectDbId}
          projectValue={schemeValue ?? ""}
          initialRows={
            termins.length >= 2
              ? termins.map((row) => ({
                  id: String(row.sequence),
                  percentage: row.percentage,
                  amount: row.amount,
                  dueDate: toDateInputValue(row.dueDate),
                }))
              : []
          }
        />
      ) : null}
    </section>
  );
}

function TerminTable({ termins }: { termins: TerminRow[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>%</TableHead>
          <TableHead>Nominal</TableHead>
          <TableHead>Jatuh tempo</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {termins.map((row) => (
          <TableRow key={row.sequence}>
            <TableCell className="angka">{row.sequence}</TableCell>
            <TableCell className="angka">{row.percentage}</TableCell>
            <TableCell className="angka">
              {formatProjectValue(row.amount) ?? row.amount}
            </TableCell>
            <TableCell className="angka">
              {formatDueDate(row.dueDate)}
            </TableCell>
            <TableCell>
              <StatusBadge status={row.status}>
                {statusLabel(row.status)}
              </StatusBadge>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
