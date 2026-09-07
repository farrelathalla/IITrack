import Link from "next/link";
import { StatusBadge } from "@/components/ui";
import { formatDateTimeId } from "@/lib/project/hub-display";
import {
  STAFFING_QUEUE_HREF,
  staffingStatusLabel,
} from "@/lib/staffing/display";
import { RequestStaffingForm } from "./staffing-form";

type StaffingRow = {
  id: string;
  roleNeeded: string;
  headcount: number;
  status: string;
  requestedAt: Date;
  fulfilledAt: Date | null;
  fulfilledByName: string | null;
};

export function StaffingPanel({
  projectDbId,
  requests,
  canRequest,
  canOpenQueue,
}: {
  projectDbId: string;
  requests: StaffingRow[];
  canRequest: boolean;
  canOpenQueue: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 border-line border-t pt-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-medium text-plum-900 text-sm">
          Permintaan programmer
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          {canOpenQueue ? (
            <Link
              href={STAFFING_QUEUE_HREF}
              className="text-slate-500 text-xs underline-offset-4 hover:text-plum-900 hover:underline"
            >
              Buka antrean CTO
            </Link>
          ) : null}
          {canRequest ? (
            <RequestStaffingForm projectDbId={projectDbId} />
          ) : null}
        </div>
      </div>

      {requests.length === 0 ? (
        <p className="text-slate-500 text-sm">
          Belum ada permintaan tenaga programmer pada project ini.
        </p>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {requests.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-1 rounded-card border border-line px-3 py-2"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {row.roleNeeded}{" "}
                  <span className="angka text-slate-500">
                    · {row.headcount} orang
                  </span>
                </span>
                <StatusBadge status={row.status}>
                  {staffingStatusLabel(row.status)}
                </StatusBadge>
              </div>
              <p className="text-slate-500 text-xs">
                Diajukan {formatDateTimeId(row.requestedAt)}
                {row.status === "FULFILLED"
                  ? ` · ditetapkan${row.fulfilledByName ? ` oleh ${row.fulfilledByName}` : ""} ${formatDateTimeId(row.fulfilledAt)}`
                  : null}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
