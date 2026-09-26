"use client";

import { Code2, FolderKanban, UserCog, Wallet } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { STAGE_TONE } from "@/components/project/tones";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoRow } from "@/components/ui/card";
import { type DivisionTab, readOnlyBanner } from "@/lib/auth/access";
import {
  financialSummary,
  isAwaitingFinance,
  TERM_STEP_LABELS,
} from "@/lib/finance/terms";
import { formatRupiah, HIDDEN } from "@/lib/money";
import {
  developersOf,
  documentOf,
  financePocOf,
  latestSubmission,
  pmOf,
} from "@/lib/project/snapshot";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { AssignmentMode } from "./assignment-modal";
import { InfoGrid, ReadOnlyBanner, Subsection } from "./bits";
import { useProject } from "./context";
import { ClosureBlock, DisbursementBlock } from "./disbursement";
import { DocumentCard, documentBadge } from "./document-card";
import { MilestonesBlock, UatControl } from "./ops";
import { TermsSummary } from "./stage-panel";
import { SubmissionBar } from "./submission-bar";
import { StaffingBlock, TechProgress, TechReferences } from "./tech";
import { TermCard } from "./terms";

function PmTab() {
  const { project, can, stages } = useProject();
  const mou = documentOf(project, "MOU");
  const mouLatest = latestSubmission(project, mou?.id);
  const mouBadge = documentBadge(mou, mouLatest);
  const developers = developersOf(project);
  const bast = documentOf(project, "BAST");

  return (
    <div className="space-y-6">
      <Subsection title="Project Overview">
        <InfoGrid>
          <InfoRow label="Project ID">{project.code}</InfoRow>
          <InfoRow label="Project Manager">
            {pmOf(project)?.name ?? "-"}
          </InfoRow>
          <InfoRow label="Tanggal Mulai">
            {formatDate(project.targetStart)}
          </InfoRow>
          <InfoRow label="Target Selesai">
            {formatDate(project.targetEnd)}
          </InfoRow>
          <InfoRow label="Status MoU">
            <Badge tone={mouBadge.tone}>
              {mou ? mouBadge.label : "Belum Ada"}
            </Badge>
          </InfoRow>
          <InfoRow label="Developer Ditugaskan">
            {developers.length > 0
              ? developers.map((d) => d.name).join(", ")
              : "Belum Ditugaskan"}
            <Badge tone={developers.length > 0 ? "success" : "neutral"}>
              {developers.length > 0 ? "Assigned" : "Belum"}
            </Badge>
          </InfoRow>
        </InfoGrid>
      </Subsection>

      <Subsection title="Client-Facing Milestones">
        <MilestonesBlock />
      </Subsection>

      <div className="grid grid-cols-2 gap-4">
        <Subsection title="Requirement Gathering">
          <DocumentCard
            kind="REQUIREMENT_GATHERING"
            editable={can["stage1.edit"] && !project.stage1DoneAt}
            statusOptions={["MISSING", "IN_PROGRESS", "SUBMITTED", "DONE"]}
          />
        </Subsection>
        <Subsection title="Project Charter">
          <DocumentCard
            kind="PROJECT_CHARTER"
            editable={can["charter.edit"] && stages[1].status !== "locked"}
          />
        </Subsection>
      </div>

      <Subsection title="Agreement Overview">
        <InfoGrid>
          <InfoRow label="Status MoU">
            <Badge tone={mouBadge.tone}>
              {mou ? mouBadge.label : "Belum Ada"}
            </Badge>
          </InfoRow>
          <InfoRow label="Status Tanda Tangan">
            {mou?.signedAt ? "Ditandatangani" : "Belum Ditandatangani"}
          </InfoRow>
          <InfoRow label="Deadline MoU">{formatDate(mou?.deadline)}</InfoRow>
        </InfoGrid>
        {mouLatest?.status === "REJECTED" ? (
          <SubmissionBar
            kind="MOU"
            label="MoU"
            approverLabel="COO / Vice COO"
            canSubmit={can["mou.edit"]}
            canDecide={false}
          />
        ) : null}
      </Subsection>

      {stages[2].status !== "locked" ? <TermsSummary /> : null}

      <div className="grid grid-cols-2 gap-4">
        <Subsection title="UAT">
          <UatControl
            editable={can["ops.edit"] && stages[6].status !== "locked"}
          />
        </Subsection>
        <Subsection title="BAST">
          <div className="flex items-center justify-between rounded-lg border border-line bg-white px-4 py-3">
            <span className="font-medium text-ink text-xs">
              Handover Report / BAST
            </span>
            <Badge
              tone={
                bast?.signedAt ? "success" : bast?.url ? "warning" : "neutral"
              }
            >
              {bast?.signedAt
                ? "Ditandatangani"
                : bast?.url
                  ? "Belum Ditandatangani"
                  : "Belum Ada"}
            </Badge>
          </div>
        </Subsection>
      </div>

      <Subsection title="Closure Checklist">
        <ClosureBlock />
      </Subsection>
    </div>
  );
}

function TechTab({ onAssign }: { onAssign: (mode: AssignmentMode) => void }) {
  const { project, can, stages } = useProject();
  const developers = developersOf(project);
  const open = stages[3].status !== "locked";

  if (!open) {
    return (
      <p className="rounded-lg border border-line border-dashed px-4 py-8 text-center text-subtle text-xs">
        Terbuka setelah Stage 3 selesai.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <Subsection title="Tech Staffing Request">
        <StaffingBlock onAssign={onAssign} />
      </Subsection>
      {developers.length > 0 ? (
        <Subsection title="Kontrak Programmer">
          <div className="space-y-3">
            {developers.map((dev) => (
              <div
                key={dev.userId}
                className="space-y-2 rounded-lg bg-surface p-3"
              >
                <DocumentCard
                  kind="PROGRAMMER_CONTRACT"
                  developerId={dev.userId}
                  title={`Kontrak Programmer: ${dev.name}`}
                  editable={can["contract.edit"]}
                />
                <SubmissionBar
                  kind="PROGRAMMER_CONTRACT"
                  developerId={dev.userId}
                  label={`Kontrak Programmer ${dev.name}`}
                  approverLabel="CTO / Vice CTO"
                  canSubmit={can["contract.edit"]}
                  canDecide={can["contract.decide"]}
                  signable
                />
              </div>
            ))}
          </div>
        </Subsection>
      ) : null}
      <Subsection title="GitHub Repository & Sprint Planning">
        <TechReferences />
      </Subsection>
      <Subsection title="Technical Progress">
        <TechProgress />
      </Subsection>
      <Subsection title="Technical Deliverables & Documentation">
        <div className="grid grid-cols-2 gap-3">
          <DocumentCard
            kind="SOURCE_CODE_DOCUMENTATION"
            editable={can["ops.edit"] && stages[8].status !== "locked"}
          />
          <DocumentCard
            kind="PROGRESS_REPORT"
            editable={can["ops.edit"] && stages[5].status !== "locked"}
          />
        </div>
      </Subsection>
    </div>
  );
}

function FinanceTab({
  onAssign,
}: {
  onAssign: (mode: AssignmentMode) => void;
}) {
  const { project, can, amountsHidden, stages } = useProject();
  const poc = financePocOf(project);
  const summary = financialSummary(project.terms);
  const mouSigned = Boolean(documentOf(project, "MOU")?.signedAt);
  const pending = project.terms.filter(
    (t) => isAwaitingFinance(t.step) || t.feedback,
  );

  return (
    <div className="space-y-6">
      <Subsection title="Finance POC">
        <div className="flex items-center justify-between gap-3 rounded-lg border border-line bg-white px-4 py-3">
          {poc ? (
            <div className="flex items-center gap-3">
              <Avatar name={poc.name} size="md" />
              <div>
                <p className="font-semibold text-ink text-sm">{poc.name}</p>
                <p className="text-[11px] text-subtle">
                  Finance POC · ditunjuk {formatDate(poc.startedAt)}
                </p>
              </div>
            </div>
          ) : (
            <p className="text-muted text-xs">
              Finance POC belum ditunjuk. Menunggu CFO/VCFO.
            </p>
          )}
          {can["financePoc.assign"] ? (
            <Button
              variant={poc ? "secondary" : "primary"}
              disabled={!mouSigned}
              onClick={() => onAssign({ kind: "finance" })}
              title={
                mouSigned
                  ? undefined
                  : "Finance POC ditunjuk setelah MoU ditandatangani."
              }
            >
              <UserCog className="size-3.5" />
              {poc ? "Ganti Finance POC" : "Tunjuk Finance POC"}
            </Button>
          ) : null}
        </div>
        {can["financePoc.assign"] && !mouSigned ? (
          <p className="text-subtle text-xs">
            Finance POC ditunjuk setelah MoU ditandatangani.
          </p>
        ) : null}
      </Subsection>

      <Subsection title="Project Financial Summary">
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: "Total Nilai Kontrak",
              value: summary.total,
              sub: "100% dari scope",
            },
            {
              label: "Sudah Terbayar",
              value: summary.paid,
              sub: `${summary.paidTerms} dari ${summary.totalTerms} termin`,
            },
            {
              label: "Sisa Tagihan",
              value: summary.remaining,
              sub: "belum diterima",
            },
          ].map((card) => (
            <div
              key={card.label}
              className="rounded-lg border border-line bg-white px-4 py-3"
            >
              <p className="text-muted text-xs">{card.label}</p>
              <p className="font-bold text-ink text-base tabular-nums">
                {amountsHidden ? HIDDEN : formatRupiah(card.value)}
              </p>
              <p className="text-[11px] text-subtle">{card.sub}</p>
            </div>
          ))}
        </div>
      </Subsection>

      <Subsection title="Payment Terms">
        {project.terms.length === 0 ? (
          <p className="rounded-lg border border-line border-dashed px-3 py-4 text-center text-subtle text-xs">
            Termin belum diisi PM.
          </p>
        ) : (
          <div className="space-y-3">
            {project.terms.map((t) => (
              <TermCard key={t.id} term={t} />
            ))}
          </div>
        )}
        {mouSigned && can["terms.edit"] ? <TermsSummary /> : null}
      </Subsection>

      <Subsection title="Pending Finance Actions">
        <div className="rounded-lg border border-line bg-white px-4 py-2">
          {pending.length === 0 ? (
            <p className="py-2 text-subtle text-xs">
              Tidak ada aksi yang tertunda saat ini.
            </p>
          ) : (
            pending.map((t) => (
              <p
                key={t.id}
                className="flex items-center gap-2 border-surface border-b py-2 text-xs last:border-0"
              >
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    t.feedback ? "bg-danger-dot" : "bg-warning-dot",
                  )}
                />
                <strong className="text-ink">{t.name}:</strong>
                <span className="text-muted">
                  {t.feedback
                    ? "Ditolak, menunggu perbaikan PM"
                    : `Status saat ini: ${TERM_STEP_LABELS[t.step]}`}
                </span>
              </p>
            ))
          )}
        </div>
      </Subsection>

      <Subsection title="Final Disbursement">
        {stages[8].status === "locked" && !project.disbursement ? (
          <div className="rounded-lg border border-line bg-white px-4 py-3">
            <Badge tone={STAGE_TONE.locked}>Belum Tersedia</Badge>
            <p className="mt-1 text-subtle text-xs">Tersedia di Stage 9.</p>
          </div>
        ) : (
          <DisbursementBlock />
        )}
      </Subsection>
    </div>
  );
}

const TABS: {
  key: DivisionTab;
  label: string;
  icon: typeof Wallet;
}[] = [
  { key: "pm", label: "Project Manager", icon: FolderKanban },
  { key: "tech", label: "Technology Dev", icon: Code2 },
  { key: "finance", label: "Finance", icon: Wallet },
];

/** Tampilan Divisi: data yang sama dari sudut pandang tiap divisi (PRD bab 8.3). */
export function DivisionTabs({
  onAssign,
}: {
  onAssign: (mode: AssignmentMode) => void;
}) {
  const { editableTabs, project } = useProject();
  const router = useRouter();
  const params = useSearchParams();
  const raw = params.get("tab");
  const tab: DivisionTab = raw === "tech" || raw === "finance" ? raw : "pm";

  function select(next: DivisionTab) {
    const search = new URLSearchParams(params.toString());
    search.set("tab", next);
    router.replace(`?${search.toString()}`, { scroll: false });
  }

  return (
    <div
      id="tampilan-divisi"
      className="overflow-hidden rounded-xl border border-line bg-white shadow-sm"
    >
      <div className="flex items-end justify-between gap-4 border-line border-b bg-surface px-5 pt-4">
        <div className="pb-3">
          <p className="font-bold text-ink text-sm">Tampilan Divisi</p>
          <p className="text-muted text-xs">
            Data yang sama, dilihat per divisi
          </p>
        </div>
        <div className="flex" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => select(t.key)}
              className={cn(
                "-mb-px flex items-center gap-1.5 rounded-t-lg border-b-2 px-4 py-2.5 font-semibold text-sm transition-colors",
                tab === t.key
                  ? "border-plum-600 bg-white text-plum-600"
                  : "border-transparent text-muted hover:text-ink",
              )}
            >
              <t.icon className="size-4" aria-hidden="true" />
              {t.label}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-4 p-5">
        <p className="text-subtle text-xs">
          Terhubung dengan workflow di atas. Perubahan di satu divisi langsung
          terlihat di divisi lain.
        </p>
        {!editableTabs[tab] ? (
          <ReadOnlyBanner>
            {readOnlyBanner(Boolean(project.closedAt), tab)}
          </ReadOnlyBanner>
        ) : null}
        {tab === "pm" ? <PmTab /> : null}
        {tab === "tech" ? <TechTab onAssign={onAssign} /> : null}
        {tab === "finance" ? <FinanceTab onAssign={onAssign} /> : null}
      </div>
    </div>
  );
}
