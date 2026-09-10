import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ProjectActivityList } from "@/components/project/activity-list";
import { Alert, StatusBadge } from "@/components/ui";
import { toActivityItem } from "@/lib/audit/activity";
import { can } from "@/lib/auth/permissions";
import { canSeeFinanceQueue } from "@/lib/finance/display";
import { canSeeInvoiceRequestForm } from "@/lib/finance/invoice-form";
import {
  canSeeReceiptForm,
  canSeeValidateReceipt,
} from "@/lib/finance/receipt-form";
import { formatProjectValue, stageLabel } from "@/lib/project/hub-display";
import { canSeeAddReferenceForm } from "@/lib/project/reference-form";
import { STAGE_CATALOGUE } from "@/lib/project/stages";
import { canSeeStaffingQueue } from "@/lib/staffing/display";
import { getAuthenticatedSession } from "@/server/auth/session";
import { readProjectInvoices } from "@/server/finance/invoice";
import { readProjectReceipts } from "@/server/finance/receipt";
import { projectContextFor } from "@/server/project/context";
import { getProjectHubByProjectId } from "@/server/project/hub";
import { ChangeStageForm } from "./change-stage-form";
import { DocumentsPanel } from "./documents-panel";
import { StaffingPanel } from "./staffing-panel";
import { TerminPanel } from "./termin-panel";

type PageProps = {
  params: Promise<{ projectId: string }>;
};

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { projectId } = await params;
  return { title: decodeURIComponent(projectId) };
}

function namesInDivision(
  members: Array<{ name: string; division: string }>,
  division: string,
): string {
  const names = members
    .filter((member) => member.division === division)
    .map((member) => member.name);
  return names.length > 0 ? names.join(", ") : "Belum ditugaskan";
}

export default async function ProjectHubPage({ params }: PageProps) {
  const { projectId: rawId } = await params;
  const projectId = decodeURIComponent(rawId);
  const session = await getAuthenticatedSession();
  if (!session) notFound();

  const hub = await getProjectHubByProjectId(session.actor, projectId);
  if (!hub) notFound();

  const now = new Date();
  const projectCtx = await projectContextFor(session.actor, hub.id, now);
  const bolehPindahTahap = can({
    actor: session.actor,
    action: "stage.change",
    project: projectCtx,
    now,
  });
  const bolehEditTermin = can({
    actor: session.actor,
    action: "project.edit_operational",
    project: projectCtx,
    now,
  });
  const bolehAjukanStaffing = can({
    actor: session.actor,
    action: "staffing.request",
    project: projectCtx,
    now,
  });
  const bolehAjukanInvoice = canSeeInvoiceRequestForm(
    session.actor,
    projectCtx,
    now,
  );
  const bolehCatatKuitansi = canSeeReceiptForm(session.actor, projectCtx, now);
  const bolehValidasiKuitansi = canSeeValidateReceipt(
    session.actor,
    projectCtx,
    now,
  );
  const bolehTambahTautan = canSeeAddReferenceForm(
    session.actor,
    projectCtx,
    now,
  );
  const bolehBukaAntrean = canSeeStaffingQueue(session.actor, now);
  const bolehBukaAntreanFinance = canSeeFinanceQueue(session.actor, now);

  const daftarInvoice = bolehBukaAntreanFinance
    ? await readProjectInvoices(session.actor, hub.id, now)
    : { ok: false as const, reason: "" };
  const invoices = daftarInvoice.ok ? daftarInvoice.invoices : [];
  const daftarKuitansi = bolehBukaAntreanFinance
    ? await readProjectReceipts(session.actor, hub.id, now)
    : { ok: false as const, reason: "" };
  const receipts = daftarKuitansi.ok ? daftarKuitansi.receipts : [];

  const nilaiTampil = formatProjectValue(hub.value);

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            Sekarang:{" "}
            <StatusBadge status={hub.stage?.key ?? "pending"}>
              {hub.stage?.label ?? stageLabel(null)}
            </StatusBadge>
          </p>
          {bolehPindahTahap ? (
            <ChangeStageForm
              key={hub.stage?.key ?? "unset"}
              projectDbId={hub.id}
              currentStageKey={hub.stage?.key ?? null}
              stages={STAGE_CATALOGUE}
            />
          ) : null}
        </div>
        <ol className="flex flex-wrap items-center gap-2 text-slate-500 text-xs">
          {hub.knownStages.map((stage, index) => {
            const aktif = hub.stage?.key === stage.key;
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
      </section>

      {/* Pending */}
      <section className="flex flex-col gap-2">
        <h2 className="text-base">Tindakan menunggu</h2>
        {hub.pendingSubmissions.length === 0 ? (
          <Alert tone="status">
            Belum ada tindakan terbuka pada project ini. Override gate dan
            antrean approval akan muncul di sini bila fiturnya sudah hidup.
          </Alert>
        ) : (
          <ul className="flex flex-col gap-2 text-sm">
            {hub.pendingSubmissions.map((item) => (
              <li
                key={item.id}
                className="rounded-card border border-line px-3 py-2"
              >
                {item.type}
                {item.currentStepOrder != null
                  ? ` · langkah ${item.currentStepOrder}`
                  : ""}
              </li>
            ))}
          </ul>
        )}
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
              <dd>{namesInDivision(hub.members, "FINANCE")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">TechDev</dt>
              <dd>{namesInDivision(hub.members, "TECHDEV")}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt className="text-slate-500">Didaftarkan oleh</dt>
              <dd>{hub.registeredByName}</dd>
            </div>
          </dl>
          <StaffingPanel
            projectDbId={hub.id}
            requests={hub.staffingRequests}
            canRequest={bolehAjukanStaffing}
            canOpenQueue={bolehBukaAntrean}
          />
        </section>

        <DocumentsPanel
          projectDbId={hub.id}
          references={hub.references}
          canAdd={bolehTambahTautan}
        />
      </div>

      {/* Termin + Riwayat */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TerminPanel
          projectDbId={hub.id}
          project={{
            projectId: hub.projectId,
            name: hub.name,
            clientName: hub.clientName,
          }}
          schemeValue={hub.schemeValue}
          displayValue={hub.value}
          termins={hub.termins}
          invoices={invoices}
          receipts={receipts}
          canEdit={bolehEditTermin}
          canRequestInvoice={bolehAjukanInvoice}
          canRecordProof={bolehCatatKuitansi}
          canValidateReceipt={bolehValidasiKuitansi}
          canOpenFinanceQueue={bolehBukaAntreanFinance}
        />

        <section className="flex flex-col gap-3 rounded-card border border-line bg-white p-5">
          <h2 className="text-base">Riwayat aktivitas</h2>
          <ProjectActivityList
            items={hub.auditTrail.map((entry) => toActivityItem(entry))}
          />
        </section>
      </div>
    </div>
  );
}
