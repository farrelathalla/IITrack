import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, StatusBadge } from "@/components/ui";
import { formatDateId } from "@/lib/member/ui";
import { formatDateTimeId } from "@/lib/project/hub-display";
import { formatWorkingDuration } from "@/lib/sla/display";
import { canSeeStaffingQueue } from "@/lib/staffing/display";
import { getAuthenticatedSession } from "@/server/auth/session";
import {
  listAssignableTechDevMembers,
  readStaffingQueue,
} from "@/server/techdev/staffing";
import { FulfillStaffingForm } from "./fulfill-form";

export const metadata: Metadata = {
  title: "Antrean staffing",
};

export default async function StaffingQueuePage() {
  const session = await getAuthenticatedSession();
  if (!session) notFound();

  const now = new Date();
  if (!canSeeStaffingQueue(session.actor, now)) notFound();

  const listed = await listAssignableTechDevMembers(session.actor, now);
  if (!listed.ok) {
    return <Alert tone="danger">{listed.reason}</Alert>;
  }

  const queue = await readStaffingQueue(now);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <p className="text-slate-500 text-xs">
          <Link href="/beranda" className="underline-offset-4 hover:underline">
            Beranda
          </Link>
          {" / "}
          Antrean staffing
        </p>
        <h1 className="text-xl">Antrean permintaan programmer</h1>
        <p className="max-w-prose text-slate-500">
          Permintaan tertua di atas. Lama menunggu dihitung dalam jam kerja,
          sama seperti SLA penugasan PM. Tidak ada ambang terlambat di dokumen,
          jadi yang ditampilkan hanya durasinya.
        </p>
      </div>

      {queue.length === 0 ? (
        <Alert tone="status">
          Tidak ada permintaan yang menunggu penetapan.
        </Alert>
      ) : (
        <ul className="flex flex-col gap-4">
          {queue.map((row) => (
            <li
              key={row.id}
              className="flex flex-col gap-4 rounded-card border border-line bg-white p-5"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-col gap-1">
                  <p className="angka font-semibold text-plum-900 text-sm">
                    <Link
                      href={`/projects/${encodeURIComponent(row.projectId)}`}
                      className="underline-offset-4 hover:underline"
                    >
                      {row.projectId}
                    </Link>
                  </p>
                  <h2 className="text-base">{row.projectName}</h2>
                  <p className="text-slate-500 text-sm">
                    Client: {row.clientName}
                    {" · "}
                    diajukan {row.requestedBy}
                    {" · "}
                    {formatDateTimeId(row.requestedAt)}
                  </p>
                </div>
                <StatusBadge tone="pending">
                  Menunggu {formatWorkingDuration(row.waitingWorkingMinutes)}
                </StatusBadge>
              </div>

              <dl className="grid gap-3 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-slate-500 text-xs">Jabatan</dt>
                  <dd>{row.roleNeeded}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-xs">Jumlah</dt>
                  <dd className="angka">{row.headcount} orang</dd>
                </div>
                <div>
                  <dt className="text-slate-500 text-xs">Dibutuhkan</dt>
                  <dd className="angka">{formatDateId(row.neededBy)}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500 text-xs">Kebutuhan teknis</dt>
                  <dd className="whitespace-pre-wrap">{row.technicalNeeds}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-slate-500 text-xs">Deliverable</dt>
                  <dd className="whitespace-pre-wrap">{row.deliverable}</dd>
                </div>
              </dl>

              <FulfillStaffingForm
                requestId={row.id}
                members={listed.members}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
