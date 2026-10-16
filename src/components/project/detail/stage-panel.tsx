"use client";

import { Check, CheckCircle2, Pencil, PenLine, X } from "lucide-react";
import { useState } from "react";
import {
  completeStage1Action,
  developmentDoneAction,
  markSignedAction,
} from "@/app/(internal)/projects/[code]/actions";
import { STAGE_TONE } from "@/components/project/tones";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoRow } from "@/components/ui/card";
import { stageOfTerm } from "@/lib/finance/terms";
import { formatRupiah, HIDDEN } from "@/lib/money";
import { stageDefinition } from "@/lib/project/catalog";
import {
  developersOf,
  documentOf,
  financePocOf,
  latestSubmission,
  WARRANTY_STATUS_LABELS,
  warrantyStatus,
} from "@/lib/project/snapshot";
import { isFeedbackComplete, STAGE_STATUS_LABELS } from "@/lib/project/stages";
import { formatDate } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { AssignmentMode } from "./assignment-modal";
import { ErrorText, InfoGrid, LockedBox, Subsection } from "./bits";
import { useProject, useRunner } from "./context";
import { ChecklistRow, ClosureBlock, DisbursementBlock } from "./disbursement";
import { DocumentCard } from "./document-card";
import {
  LatestUpdateForm,
  StageDeadline,
  UatControl,
  WarrantyBlock,
} from "./ops";
import { SubmissionBar } from "./submission-bar";
import {
  StaffingBlock,
  TechProgress,
  TechPulseCard,
  TechReferences,
} from "./tech";
import { PaymentFlow, TermCard, TermsEditor, termDueLabel } from "./terms";

const MANUAL_STATUS = ["MISSING", "IN_PROGRESS", "SUBMITTED", "DONE"] as const;

function openGaps(
  project: ReturnType<typeof useProject>["project"],
  kind: "MOU" | "PROGRAMMER_CONTRACT",
  label: string,
  developerId = "",
): string[] {
  const doc = documentOf(project, kind, developerId);
  const latest = latestSubmission(project, doc?.id);
  if (!doc?.url) return [`Tautan ${label} belum diisi.`];
  if (!latest) return [`${label} belum diajukan untuk persetujuan.`];
  if (latest.status === "REJECTED") {
    return [`${label} ditolak. Perbaiki lalu ajukan ulang.`];
  }
  if (latest.status === "PENDING") {
    return [`${label} masih menunggu persetujuan.`];
  }
  if (!doc.signedAt) {
    return [
      `Tanda tangan ${label} belum dicatat. Tombol Tandai Ditandatangani ada di kartu dokumen, di bawah status Disetujui.`,
    ];
  }
  return [];
}

function StageNeeds({ stage }: { stage: number }) {
  const { project } = useProject();
  const gaps: string[] = [];
  if (stage === 1 && !documentOf(project, "REQUIREMENT_GATHERING")?.url) {
    gaps.push("Tautan Requirement Gathering belum diisi.");
  }
  if (stage === 2) {
    const charter = documentOf(project, "PROJECT_CHARTER");
    const latest = latestSubmission(project, charter?.id);
    if (!charter?.url) gaps.push("Tautan Project Charter belum diisi.");
    if (!latest) gaps.push("Project Charter belum diajukan.");
    if (latest?.status === "PENDING" && !latest.opsApprovedAt) {
      gaps.push("Persetujuan COO atau Vice COO belum ada.");
    }
    if (latest?.status === "PENDING" && !latest.techApprovedAt) {
      gaps.push("Persetujuan CTO atau Vice CTO belum ada.");
    }
    if (latest?.status === "REJECTED") {
      gaps.push("Project Charter ditolak. Ajukan ulang setelah diperbaiki.");
    }
  }
  if (stage === 3) gaps.push(...openGaps(project, "MOU", "MoU"));
  if (stage === 4) {
    const developers = developersOf(project);
    if (developers.length === 0) {
      gaps.push("Belum ada developer yang ditugaskan.");
    }
    for (const developer of developers) {
      gaps.push(
        ...openGaps(
          project,
          "PROGRAMMER_CONTRACT",
          `Kontrak Programmer ${developer.name}`,
          developer.userId,
        ),
      );
    }
  }
  if (stage === 5) {
    if (!financePocOf(project)) {
      gaps.push(
        "Finance POC belum ditunjuk. Tombolnya di Ringkasan per divisi → tab Finance (CFO / Vice CFO).",
      );
    }
    const dp = project.terms.find((term) => term.sequence === 1);
    if (!dp) gaps.push("Termin DP belum diisi.");
    else if (dp.step !== "DONE") gaps.push(`${dp.name} belum lunas.`);
  }
  if (stage === 6) {
    if (!project.developmentDoneAt) {
      gaps.push("Pengembangan belum ditandai selesai.");
    }
    for (const term of project.terms) {
      if (stageOfTerm(term.sequence, project.terms.length) !== 6) continue;
      if (term.feedback && term.step !== "DONE") {
        gaps.push(
          `${term.name} ada umpan balik finance. Perbaiki, lalu lanjutkan alur invoice.`,
        );
      }
    }
  }
  if (stage === 7) {
    const bast = documentOf(project, "BAST");
    if (!bast?.url) gaps.push("Tautan BAST belum diisi.");
    else if (!bast.signedAt) gaps.push("Tanda tangan BAST belum dicatat.");
    const total = project.terms.length;
    const final =
      total > 1
        ? project.terms.find((term) => term.sequence === total)
        : project.terms[0];
    if (final && final.step !== "DONE") {
      gaps.push(`${final.name} belum lunas.`);
    }
    const now = new Date();
    const warranty = warrantyStatus(project.handover, now);
    if (!project.handover?.warrantyStart || !project.handover.warrantyEnd) {
      gaps.push("Tanggal mulai dan akhir garansi belum diisi.");
    } else if (warranty !== "DONE") {
      gaps.push(
        warranty === "NOT_STARTED"
          ? `Garansi belum dimulai (${formatDate(project.handover.warrantyStart)}). Stage 7 selesai sehari setelah tanggal akhir garansi.`
          : `Garansi masih ${WARRANTY_STATUS_LABELS.ACTIVE} sampai ${formatDate(project.handover.warrantyEnd)}. Stage 7 selesai sehari setelah tanggal itu (WIB), bukan saat tanggal diisi.`,
      );
    }
  }
  if (stage === 8) {
    if (!isFeedbackComplete(documentOf(project, "CLIENT_FEEDBACK"))) {
      gaps.push("Client Feedback belum lengkap (tautan dan status Selesai).");
    }
    if (!isFeedbackComplete(documentOf(project, "PROGRAMMER_FEEDBACK"))) {
      gaps.push(
        "Programmer Feedback belum lengkap (tautan dan status Selesai).",
      );
    }
  }
  if (stage === 9) {
    if (!documentOf(project, "PROJECT_DOCUMENTATION")?.url) {
      gaps.push("Project Documentation belum ditautkan.");
    }
    if (!documentOf(project, "SOURCE_CODE_DOCUMENTATION")?.url) {
      gaps.push("Source Code Documentation belum ditautkan.");
    }
    if (project.disbursement?.status !== "DISBURSED") {
      gaps.push(
        "Finance Disbursement belum dicairkan. Pengajuan boleh sebelum dokumentasi; tutup project tidak.",
      );
    }
  }
  if (gaps.length === 0) return null;
  return (
    <div className="rounded-lg border border-line bg-surface px-4 py-3">
      <p className="font-bold text-ink text-base">
        Yang masih kurang sebelum tahap ini selesai
      </p>
      <ul className="mt-2 list-disc space-y-1.5 pl-5 text-ink text-sm">
        {gaps.map((gap) => (
          <li key={gap}>{gap}</li>
        ))}
      </ul>
    </div>
  );
}

function Stage1() {
  const { project, can } = useProject();
  const { run, pending, error } = useRunner();
  const doc = documentOf(project, "REQUIREMENT_GATHERING");
  return (
    <>
      <Subsection title="Dokumen yang Diperlukan">
        <DocumentCard
          kind="REQUIREMENT_GATHERING"
          editable={can["stage1.edit"] && !project.stage1DoneAt}
          statusOptions={[...MANUAL_STATUS]}
        />
      </Subsection>
      <ErrorText error={error} />
      {can["stage1.edit"] && !project.stage1DoneAt ? (
        <div className="flex items-center gap-2">
          <Button
            disabled={pending || !doc?.url}
            onClick={() => run(() => completeStage1Action(project.code))}
          >
            <Check className="size-3.5" />
            Tandai Selesai
          </Button>
          {!doc?.url ? (
            <span className="text-subtle text-xs">Tautkan dokumen dulu.</span>
          ) : null}
        </div>
      ) : null}
    </>
  );
}

function Stage2() {
  const { can, namedApprovers } = useProject();
  const editable = can["charter.edit"];
  return (
    <>
      <Subsection title="Dokumen Utama">
        <DocumentCard kind="PROJECT_CHARTER" editable={editable} />
      </Subsection>
      <Subsection title="Dokumen Pendukung (Opsional)">
        <DocumentCard kind="GANTT_CHART" editable={editable} />
      </Subsection>
      <div className="rounded-lg border border-line bg-white px-4 py-3 text-sm">
        <p className="font-semibold text-ink">
          Stage ini selesai setelah COO atau Vice COO dan CTO atau Vice CTO
          sama-sama menyetujui.
        </p>
        <p className="mt-1 text-ink">
          {`Approver yang ditunjuk: COO ${namedApprovers.charterOps ?? "belum dipilih"}, CTO ${namedApprovers.charterTech ?? "belum dipilih"}. Siapa pun yang sedang menjabat jabatan itu tetap bisa memutuskan.`}
        </p>
      </div>
      <SubmissionBar
        kind="PROJECT_CHARTER"
        label="Project Charter"
        approverLabel="COO / Vice COO dan CTO / Vice CTO"
        canSubmit={editable}
        canDecide={can["charter.decide"]}
        canDecideTech={can["charter.decideTech"]}
      />
    </>
  );
}

export function TermsSummary() {
  const { project, can, amountsHidden } = useProject();
  const [editing, setEditing] = useState(false);
  const mou = documentOf(project, "MOU");
  const mouPending = latestSubmission(project, mou?.id)?.status === "PENDING";
  const total = project.terms.reduce((s, t) => s + t.amount, 0);
  return (
    <Subsection
      title="Termin Pembayaran"
      action={
        can["terms.edit"] && !mouPending ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditing(true)}
          >
            <Pencil className="size-3.5" />
            {project.terms.length === 0 ? "Isi Termin" : "Ubah Termin"}
          </Button>
        ) : null
      }
    >
      {project.terms.length === 0 ? (
        <p className="rounded-lg border border-line border-dashed px-3 py-4 text-center text-subtle text-xs">
          Termin belum diisi.
        </p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-line bg-white">
          <table className="w-full text-xs">
            <thead className="bg-surface text-left text-[10px] text-muted uppercase tracking-wider">
              <tr>
                <th className="px-3 py-2">Termin</th>
                <th className="px-3 py-2">%</th>
                <th className="px-3 py-2">Nominal</th>
                <th className="px-3 py-2">Due Date</th>
                <th className="px-3 py-2">Stage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-surface">
              {project.terms.map((t) => (
                <tr key={t.id}>
                  <td className="px-3 py-2 font-medium text-ink">{t.name}</td>
                  <td className="px-3 py-2 tabular-nums">{t.percentage}%</td>
                  <td className="px-3 py-2 tabular-nums">
                    {amountsHidden ? HIDDEN : formatRupiah(t.amount)}
                  </td>
                  <td className="px-3 py-2">{termDueLabel(t)}</td>
                  <td className="px-3 py-2 text-muted">
                    Stage {stageOfTerm(t.sequence, project.terms.length)}
                  </td>
                </tr>
              ))}
              <tr className="bg-surface font-semibold">
                <td className="px-3 py-2">Total Nilai Kontrak</td>
                <td className="px-3 py-2">100%</td>
                <td className="px-3 py-2 tabular-nums" colSpan={3}>
                  {amountsHidden ? HIDDEN : formatRupiah(total)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {editing ? <TermsEditor open onOpenChange={setEditing} /> : null}
    </Subsection>
  );
}

function Stage3() {
  const { project, can } = useProject();
  const mou = documentOf(project, "MOU");
  const latest = latestSubmission(project, mou?.id);
  return (
    <>
      <Subsection title="Dokumen Perjanjian">
        <DocumentCard kind="MOU" editable={can["mou.edit"]} />
      </Subsection>
      <TermsSummary />
      <Subsection title="Status Persetujuan">
        <InfoGrid>
          <InfoRow label="Status Draft">
            {mou && (mou.url || mou.status !== "MISSING")
              ? "Draft Tersedia"
              : "Belum Ada"}
          </InfoRow>
          <InfoRow label="Status Pengajuan">
            {latest ? "Diajukan" : "Belum Diajukan"}
          </InfoRow>
          <InfoRow label="Status Persetujuan">
            {latest ? (
              <Badge
                tone={
                  latest.status === "APPROVED"
                    ? "success"
                    : latest.status === "REJECTED"
                      ? "danger"
                      : "warning"
                }
                dot
              >
                {latest.status === "APPROVED"
                  ? "Disetujui"
                  : latest.status === "REJECTED"
                    ? "Ditolak"
                    : "Menunggu"}
              </Badge>
            ) : (
              "-"
            )}
          </InfoRow>
          <InfoRow label="Status Tanda Tangan">
            {mou?.signedAt ? "Ditandatangani" : "Belum Ditandatangani"}
          </InfoRow>
          <InfoRow label="Deadline">{formatDate(mou?.deadline)}</InfoRow>
        </InfoGrid>
      </Subsection>
      <SubmissionBar
        kind="MOU"
        label="MoU"
        approverLabel="COO / Vice COO"
        canSubmit={can["mou.edit"]}
        canDecide={can["mou.decide"]}
        signable
      />
      {latest?.status === "APPROVED" && !mou?.signedAt ? (
        <p className="rounded-xl border-2 border-warning-dot bg-warning-bg px-5 py-4 font-medium text-ink text-sm">
          Kirim MoU ke client, ganti tautan dengan versi bertanda tangan, lalu
          tekan tombol besar Tandai Ditandatangani di kartu dokumen. Tanpa itu,
          Programmer Assignment tetap terkunci.
        </p>
      ) : null}
    </>
  );
}

function Stage4({ onAssign }: { onAssign: (mode: AssignmentMode) => void }) {
  const { project, can } = useProject();
  const developers = developersOf(project);
  return (
    <>
      <Subsection title="Request SDM">
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
      <Subsection title="Referensi Teknis">
        <TechReferences />
      </Subsection>
      {!financePocOf(project) ? (
        <p className="text-subtle text-xs">
          Stage 5 terbuka setelah Stage 4 selesai dan Finance POC ditunjuk.
        </p>
      ) : null}
    </>
  );
}

function Stage5() {
  const { project } = useProject();
  const dp = project.terms.find((t) => t.sequence === 1);
  if (!dp) return <p className="text-subtle text-xs">Termin DP belum diisi.</p>;
  return (
    <>
      <Subsection title="Alur Pembayaran DP">
        <PaymentFlow step={dp.step} />
      </Subsection>
      <Subsection title="Detail Pembayaran">
        <TermCard term={dp} />
      </Subsection>
    </>
  );
}

function Stage6() {
  const { project, can } = useProject();
  const { run, pending, error } = useRunner();
  const total = project.terms.length;
  const middle = project.terms.filter(
    (t) => stageOfTerm(t.sequence, total) === 6,
  );
  return (
    <>
      <TechPulseCard />
      <Subsection title="Referensi Teknis">
        <TechReferences />
      </Subsection>
      <Subsection title="Progress Pengembangan" action={<LatestUpdateForm />}>
        <TechProgress />
      </Subsection>
      <Subsection title="Project Progress Report (Opsional)">
        <DocumentCard kind="PROGRESS_REPORT" editable={can["ops.edit"]} />
      </Subsection>
      <Subsection title="Termin Pembayaran">
        {middle.length === 0 ? (
          <p className="text-subtle text-xs">
            Tidak ada termin lanjutan di stage ini.
          </p>
        ) : (
          <div className="space-y-2">
            {middle.map((t) => (
              <TermCard key={t.id} term={t} />
            ))}
          </div>
        )}
      </Subsection>
      <p className="text-ink text-sm">
        Eksekusi tidak menunggu Down Payment. Keduanya berjalan bersamaan
        setelah tech assignment selesai.
      </p>
      <ErrorText error={error} />
      {can["ops.edit"] && !project.developmentDoneAt ? (
        <Button
          onClick={() => run(() => developmentDoneAction(project.code))}
          disabled={pending}
        >
          <CheckCircle2 className="size-4" />
          Tandai Pengembangan Selesai
        </Button>
      ) : null}
    </>
  );
}

function Stage7() {
  const { project, can } = useProject();
  const { run, pending, error } = useRunner();
  const total = project.terms.length;
  const final =
    total > 1 ? project.terms.find((t) => t.sequence === total) : undefined;
  const bast = documentOf(project, "BAST");
  return (
    <>
      <Subsection title="Pengujian & Handover">
        <div className="space-y-2">
          <DocumentCard kind="TESTING_RESULT" editable={can["ops.edit"]} />
          <UatControl editable={can["ops.edit"]} />
          <DocumentCard
            kind="BAST"
            editable={can["ops.edit"] && !bast?.signedAt}
          />
          <ErrorText error={error} />
          {can["ops.edit"] && bast?.url && !bast.signedAt ? (
            <div className="rounded-xl border-2 border-warning-dot bg-warning-bg px-5 py-4">
              <p className="font-bold text-ink text-base">
                Tanda tangan BAST belum dicatat
              </p>
              <p className="mt-1 text-ink text-sm">
                Tanpa langkah ini, Handover tidak selesai dan Evaluation tetap
                terkunci.
              </p>
              <Button
                size="lg"
                className="mt-4"
                disabled={pending}
                onClick={() =>
                  run(() => markSignedAction(project.code, "BAST"))
                }
              >
                <PenLine className="size-4" />
                Tandai BAST Ditandatangani
              </Button>
            </div>
          ) : null}
        </div>
      </Subsection>
      <Subsection title="Pembayaran Final">
        {final ? (
          <TermCard term={final} />
        ) : (
          <p className="text-subtle text-xs">Tidak ada termin final.</p>
        )}
      </Subsection>
      <Subsection title="Garansi">
        <WarrantyBlock editable={can["ops.edit"] && Boolean(bast?.signedAt)} />
      </Subsection>
    </>
  );
}

function Stage8() {
  const { project, can } = useProject();
  return (
    <>
      <Subsection title="Checklist Evaluasi">
        <div className="rounded-lg border border-line bg-white px-4 py-1">
          <ChecklistRow
            label="Client Feedback"
            done={isFeedbackComplete(documentOf(project, "CLIENT_FEEDBACK"))}
          />
          <ChecklistRow
            label="Programmer Feedback"
            done={isFeedbackComplete(
              documentOf(project, "PROGRAMMER_FEEDBACK"),
            )}
          />
        </div>
      </Subsection>
      <div className="grid grid-cols-2 gap-3">
        <DocumentCard kind="CLIENT_FEEDBACK" editable={can["ops.edit"]} />
        <DocumentCard kind="PROGRAMMER_FEEDBACK" editable={can["ops.edit"]} />
      </div>
      <p className="text-subtle text-xs">
        Tautkan hasil form feedback di sini.
      </p>
    </>
  );
}

function Stage9() {
  const { can } = useProject();
  return (
    <>
      <Subsection title="Dokumentasi">
        <div className="grid grid-cols-2 gap-3">
          <DocumentCard
            kind="PROJECT_DOCUMENTATION"
            editable={can["ops.edit"]}
          />
          <DocumentCard
            kind="SOURCE_CODE_DOCUMENTATION"
            editable={can["ops.edit"]}
          />
        </div>
      </Subsection>
      <Subsection title="Finance Disbursement">
        <DisbursementBlock />
      </Subsection>
      <Subsection title="Closure Checklist">
        <ClosureBlock />
      </Subsection>
    </>
  );
}

/** Panel stage: header, deskripsi, kotak terkunci, isi, dan deadline (PRD bab 8.3). */
export function StagePanel({
  stage,
  onAssign,
}: {
  stage: number;
  onAssign: (mode: AssignmentMode) => void;
}) {
  const { stages } = useProject();
  const state = stages.find((s) => s.n === stage) ?? stages[0];
  const def = stageDefinition(state.n);
  const locked = state.status === "locked";
  const done = state.status === "completed" || state.status === "approved";
  const revision = state.status === "revision-required";

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-white shadow-sm",
        revision ? "border-red-300" : "border-line",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between gap-4 border-b px-5 py-4",
          revision
            ? "border-red-200 bg-danger-bg"
            : locked
              ? "border-line bg-surface"
              : done
                ? "border-success-line bg-success-bg"
                : "border-plum-200 bg-plum-50",
        )}
      >
        <div className="flex items-center gap-3">
          <span
            className={cn(
              "flex size-9 items-center justify-center rounded-full font-bold text-sm",
              revision
                ? "bg-red-100 text-danger-text"
                : locked
                  ? "bg-line text-subtle"
                  : done
                    ? "bg-success-text text-white"
                    : "bg-plum-600 text-white",
            )}
          >
            {done ? (
              <Check className="size-4" />
            ) : revision ? (
              <X className="size-4" />
            ) : (
              def.n
            )}
          </span>
          <div>
            <p className="text-[11px] text-muted">
              Stage {def.n} dari 9 · {def.divisionLabel}
            </p>
            <h3
              className={cn(
                "font-bold text-sm",
                locked ? "text-subtle" : "text-ink",
              )}
            >
              {def.name}
            </h3>
          </div>
        </div>
        <Badge tone={STAGE_TONE[state.status]} dot>
          {STAGE_STATUS_LABELS[state.status]}
        </Badge>
      </div>

      <div className="space-y-5 p-5">
        <p
          className={cn(
            "text-xs leading-relaxed",
            locked ? "text-subtle" : "text-muted",
          )}
        >
          {def.description}
        </p>
        {locked ? (
          <LockedBox
            reason={
              state.lockedReason ??
              "Selesaikan stage sebelumnya terlebih dahulu."
            }
          />
        ) : (
          <>
            <StageNeeds stage={state.n} />
            {state.n === 1 ? <Stage1 /> : null}
            {state.n === 2 ? <Stage2 /> : null}
            {state.n === 3 ? <Stage3 /> : null}
            {state.n === 4 ? <Stage4 onAssign={onAssign} /> : null}
            {state.n === 5 ? <Stage5 /> : null}
            {state.n === 6 ? <Stage6 /> : null}
            {state.n === 7 ? <Stage7 /> : null}
            {state.n === 8 ? <Stage8 /> : null}
            {state.n === 9 ? <Stage9 /> : null}
            <div className="flex gap-8 border-surface border-t pt-4">
              <div>
                <p className="mb-0.5 font-semibold text-[10px] text-subtle uppercase tracking-wider">
                  Deadline
                </p>
                <StageDeadline stage={state.n} />
              </div>
              <div>
                <p className="mb-0.5 font-semibold text-[10px] text-subtle uppercase tracking-wider">
                  Tanggal Selesai
                </p>
                <p className="font-medium text-ink text-xs">
                  {formatDate(state.completedAt)}
                </p>
              </div>
              {state.waitingFor ? (
                <div>
                  <p className="mb-0.5 font-semibold text-[10px] text-subtle uppercase tracking-wider">
                    Menunggu
                  </p>
                  <p className="font-medium text-warning-text text-xs">
                    {state.waitingFor}
                  </p>
                </div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
