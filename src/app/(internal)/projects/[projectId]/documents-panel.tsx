import { Alert } from "@/components/ui";
import type { ReferenceKind } from "@/lib/project/external-reference";
import { referenceKindLabel } from "@/lib/project/reference-form";
import { AddReferenceForm } from "./reference-form";

type ReferenceRow = {
  kind: ReferenceKind;
  url: string;
  label: string;
};

export function DocumentsPanel({
  projectDbId,
  references,
  canAdd,
}: {
  projectDbId: string;
  references: ReferenceRow[];
  canAdd: boolean;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-card border border-line bg-white p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base">Dokumen & tautan</h2>
        {canAdd ? <AddReferenceForm projectDbId={projectDbId} /> : null}
      </div>

      {references.length === 0 ? (
        <Alert tone="status">
          Belum ada tautan Drive, Notion, atau GitHub pada project ini. Daftar
          dokumen (F11) belum tersedia.
        </Alert>
      ) : (
        <ul className="flex flex-col gap-2 text-sm">
          {references.map((ref) => (
            <li key={`${ref.kind}-${ref.url}`}>
              <a
                href={ref.url}
                className="font-medium text-plum-900 underline-offset-4 hover:underline"
                rel="noreferrer"
                target="_blank"
              >
                {ref.label}
              </a>
              <span className="text-slate-500 text-xs">
                {" "}
                · {referenceKindLabel(ref.kind)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
