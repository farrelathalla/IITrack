import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Alert, StatusBadge } from "@/components/ui";
import { can } from "@/lib/auth/permissions";
import {
  formatDateTimeId,
  formatProjectValue,
  stageLabel,
  summarizeAuditAction,
} from "@/lib/project/hub-display";
import { getAuthenticatedSession } from "@/server/auth/session";
import { projectContextFor } from "@/server/project/context";
import { getProjectHubByProjectId } from "@/server/project/hub";

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { projectId } = await params;
  return { title: decodeURIComponent(projectId) };
}

export default async function ProjectHubPage({ params }: PageProps) {
  const { projectId: rawId } = await params;
  const projectId = decodeURIComponent(rawId);
  const hub = await getProjectHubByProjectId(projectId);
  if (!hub) notFound();

  const session = await getAuthenticatedSession();
  const now = new Date();
  const projectCtx =
    session !== null
      ? await projectContextFor(session.actor, hub.id, now)
      : { projectId: hub.id, assignedDivisions: [] };
  const bolehLihatNilai =
    session !== null &&
    can({
      actor: session.actor,
      action: "project.view_value",
      project: projectCtx,
      now,
    });
  const bolehPindahTahap =
    session !== null &&
    can({
      actor: session.actor,
      action: "stage.change",
      project: projectCtx,
      now,
    });

  const nilaiTampil = bolehLihatNilai ? formatProjectValue(hub.value) : null;

  return (
    <div className="flex flex-col gap-8">
      {/* Identitas */}
      <section className="flex flex-col gap-3">
        <p className="text-slate-500 text-xs">
          <Link href="/projects" className="underline-offset-4 hover:underline">
            Project
          </Link>
          {" / "}
          <span className="angka">{hub.projectId}</span>
        </p>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <p className="angka font-semibold text-plum-900 text-sm">
              {hub.projectId}
            </p>
            <h1 className="text-xl">{hub.name}</h1>
            <p className="text-slate-500 text-sm">
              Client: {hub.clientName}
              {" · "}
              Periode: {hub.period}
              {" · "}
              <StatusBadge status={hub.status}>{hub.status}</StatusBadge>
            </p>
            {nilaiTampil ? (
              <p className="angka text-plum-900 text-sm">
                Nilai: {nilaiTampil}
              </p>
            ) : null}
          </div>
        </div>
      </section>

      {/* Tahap */}
      <section className="flex flex-col gap-3 rounded-card border border-line bg-white p-5">
        <h2 className="text-base">Tahap berjalan</h2>
        <p className="text-sm">
          Sekarang:{" "}
          <StatusBadge status={hub.stage ?? "pending"}>
            {stageLabel(hub.stage)}
          </StatusBadge>
        </p>
        <ol className="flex flex-wrap items-center gap-2 text-slate-500 text-xs">
          {hub.knownStages.map((stage, index) => {
            const aktif = hub.stage === stage.key;
            return (
              <li key={stage.key} className="flex items-center gap-2">
                {index > 0 ? <span aria-hidden>→</span> : null}
                <span
                  className={aktif ? "font-semibold text-plum-900" : undefined}
                >
                  {stage.order}. {stage.label}
                  {aktif ? " *" : ""}
                </span>
              </li>
            );
          })}
          {hub.knownStages.length < 11 ? (
            <li className="flex items-center gap-2">
              <span aria-hidden>→</span>
              <span className="italic">
                … tahap lain menunggu daftar resmi (DEP-04)
              </span>
            </li>
          ) : null}
        </ol>
        {bolehPindahTahap ? (
          <p className="text-slate-500 text-sm">
            Tombol mengajukan perpindahan tahap menyusul di F09-T02 (#66).
          </p>
        ) : null}
      </section>

      {/* Pending — kosong dulu */}
      <section className="flex flex-col gap-2">
        <h2 className="text-base">Tindakan menunggu</h2>
        <Alert tone="status">
          Belum ada tindakan terbuka pada project ini. Override gate dan antrean
          approval akan muncul di sini bila fiturnya sudah hidup.
        </Alert>
      </section>

      {/* Tim + Dokumen */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-card border border-line bg-white p-5">
          <h2 className="text-base">Tim & penugasan</h2>
          <dl className="flex flex-col gap-2 text-sm">
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Operational (PM)</dt>
              <dd>{hub.assignedPmName ?? "Belum ditugaskan"}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Finance</dt>
              <dd className="text-slate-500">Menyusul F31</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">TechDev</dt>
              <dd className="text-slate-500">Menyusul F31</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Didaftarkan oleh</dt>
              <dd>{hub.registeredByName}</dd>
            </div>
          </dl>
        </section>

        <section className="flex flex-col gap-3 rounded-card border border-line bg-white p-5">
          <h2 className="text-base">Dokumen & tautan</h2>
          <Alert tone="status">
            Daftar dokumen (F11) dan tautan Drive/Notion/GitHub (F25) belum
            tersedia. Section ini sudah disiapkan supaya hub tidak berubah
            layout nanti.
          </Alert>
        </section>
      </div>

      {/* Termin + Riwayat */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="flex flex-col gap-3 rounded-card border border-line bg-white p-5">
          <h2 className="text-base">Termin & pembayaran</h2>
          <Alert tone="status">
            Skema termin (F13) belum ada di basis data. Slot ini mengikuti
            wireframe F08 agar posisi panel tetap.
          </Alert>
        </section>

        <section className="flex flex-col gap-3 rounded-card border border-line bg-white p-5">
          <h2 className="text-base">Riwayat aktivitas</h2>
          {hub.auditTrail.length === 0 ? (
            <p className="text-slate-500 text-sm">
              Belum ada jejak pada project ini.
            </p>
          ) : (
            <ul className="flex flex-col gap-3 text-sm">
              {hub.auditTrail.map((entry) => (
                <li
                  key={`${entry.createdAt.toISOString()}-${entry.action}`}
                  className="border-line border-b pb-2 last:border-0"
                >
                  <p className="font-medium text-plum-900">
                    {summarizeAuditAction(entry.action)}
                  </p>
                  <p className="text-slate-500 text-xs">
                    <span className="angka">
                      {formatDateTimeId(entry.createdAt)}
                    </span>
                    {" · "}
                    {entry.actorName ?? "Sistem"}
                    {entry.reason ? ` · ${entry.reason}` : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
          {hub.stageHistory.length > 0 ? (
            <div className="mt-2 flex flex-col gap-2 border-line border-t pt-3">
              <h3 className="text-slate-500 text-xs uppercase tracking-wide">
                Riwayat tahap
              </h3>
              <ul className="flex flex-col gap-2 text-sm">
                {hub.stageHistory.map((entry) => (
                  <li key={`${entry.changedAt.toISOString()}-${entry.toStage}`}>
                    <span className="angka text-xs text-slate-500">
                      {formatDateTimeId(entry.changedAt)}
                    </span>
                    {" · "}
                    {entry.changedBy}
                    {": "}
                    {stageLabel(entry.fromStage)} → {stageLabel(entry.toStage)}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
