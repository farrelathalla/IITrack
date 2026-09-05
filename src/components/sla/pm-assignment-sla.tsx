import { StatusBadge } from "@/components/ui";
import { buildPmAssignmentSlaView } from "@/lib/sla/display";

/**
 * Menampilkan selisih waktu penugasan PM terhadap ambang enam jam kerja (F04-T02).
 *
 * Komponen ini murni tampilan: perhitungan jam kerja tetap di `lib/sla`.
 */
export function PmAssignmentSla({
  clientConfirmedAt,
  pmAssignedAt,
  projectId,
  pmName,
}: {
  clientConfirmedAt: Date | null;
  pmAssignedAt: Date | null;
  projectId?: string;
  pmName?: string | null;
}) {
  const view = buildPmAssignmentSlaView({
    clientConfirmedAt,
    pmAssignedAt,
  });

  if (!view) {
    return (
      <div className="rounded-card border border-line bg-white px-4 py-3 text-slate-500 text-sm">
        {projectId ? (
          <p className="font-medium text-plum-900">{projectId}</p>
        ) : null}
        <p>
          SLA penugasan belum bisa ditampilkan. Butuh waktu konfirmasi client
          dan waktu PM ditugaskan.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-card border border-line bg-white px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          {projectId ? (
            <p className="font-semibold text-plum-900">{projectId}</p>
          ) : (
            <p className="font-semibold text-plum-900">SLA penugasan PM</p>
          )}
          {pmName ? (
            <p className="text-slate-500 text-xs">PM: {pmName}</p>
          ) : null}
        </div>
        <StatusBadge tone={view.tone}>{view.badgeLabel}</StatusBadge>
      </div>

      <p className="text-sm text-ink">{view.summary}</p>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
        <div>
          <dt className="text-slate-500">Lama penugasan</dt>
          <dd className="angka font-medium text-plum-900">
            {view.elapsedLabel}
          </dd>
        </div>
        <div>
          <dt className="text-slate-500">Ambang SLA</dt>
          <dd className="angka font-medium text-plum-900">
            {view.thresholdLabel}
          </dd>
        </div>
      </dl>
    </div>
  );
}
