"use client";

import { useState } from "react";
import { saveApproversAction } from "@/app/(internal)/settings/actions";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { useRunner } from "@/components/use-runner";
import { cn } from "@/lib/utils";
import type { ApprovalKind, ApproverSetting } from "@/server/settings";

export interface WorkflowRow {
  kind: ApprovalKind;
  label: string;
  approverLabel: string;
  primaryHint: string;
  delegateHint: string;
  /** Tidak bisa dipilih manual: Finance POC ditentukan per project. */
  primaryFixed: boolean;
  primaryOptions: { id: string; name: string; email: string }[];
  delegateOptions: { id: string; name: string; email: string }[];
  value: ApproverSetting;
}

/**
 * Workflow & Approver (PRD bab 8.7). Nama approver utama dan delegasi dipakai
 * untuk teks "Menunggu persetujuan dari …"; wewenang memutuskan tetap mengikuti
 * jabatan, sehingga jabatan utama dan wakil sama-sama bisa memutuskan.
 */
export function WorkflowSection({
  rows,
  canManage,
}: {
  rows: WorkflowRow[];
  canManage: boolean;
}) {
  const [values, setValues] = useState(
    () =>
      Object.fromEntries(rows.map((r) => [r.kind, r.value])) as Record<
        ApprovalKind,
        ApproverSetting
      >,
  );
  const { run, pending, error, message } = useRunner();

  const person = (options: WorkflowRow["primaryOptions"], id: string | null) =>
    options.find((o) => o.id === id);

  return (
    <div className="space-y-3">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
      <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
        <table className="w-full text-left text-xs">
          <thead className="border-line border-b bg-surface">
            <tr>
              {["Pengajuan", "Jabatan approver", "Utama", "Delegasi"].map(
                (h) => (
                  <th
                    key={h}
                    className="whitespace-nowrap px-4 py-2.5 font-semibold text-[11px] text-muted uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface">
            {rows.map((row) => {
              const value = values[row.kind];
              const primary = person(row.primaryOptions, value.primaryUserId);
              const delegate = person(
                row.delegateOptions,
                value.delegateUserId,
              );
              return (
                <tr key={row.kind}>
                  <td className="px-4 py-3 font-medium text-ink">
                    {row.label}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {row.approverLabel}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {row.primaryFixed ? (
                      <span className="text-muted">{row.primaryHint}</span>
                    ) : canManage ? (
                      <select
                        aria-label={`Approver utama ${row.label}`}
                        value={value.primaryUserId ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            [row.kind]: {
                              ...v[row.kind],
                              primaryUserId: e.target.value || null,
                            },
                          }))
                        }
                        className={cn(FIELD_CONTROL, "py-1.5 text-xs")}
                      >
                        <option value="">{row.primaryHint}</option>
                        {row.primaryOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    ) : primary ? (
                      <span>
                        <span className="block font-medium text-ink">
                          {primary.name}
                        </span>
                        <span className="text-subtle">{primary.email}</span>
                      </span>
                    ) : (
                      <span className="text-subtle">{row.primaryHint}</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {canManage ? (
                      <select
                        aria-label={`Delegasi ${row.label}`}
                        value={value.delegateUserId ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({
                            ...v,
                            [row.kind]: {
                              ...v[row.kind],
                              delegateUserId: e.target.value || null,
                            },
                          }))
                        }
                        className={cn(FIELD_CONTROL, "py-1.5 text-xs")}
                      >
                        <option value="">{row.delegateHint}</option>
                        {row.delegateOptions.map((o) => (
                          <option key={o.id} value={o.id}>
                            {o.name}
                          </option>
                        ))}
                      </select>
                    ) : delegate ? (
                      <span>
                        <span className="block font-medium text-ink">
                          {delegate.name}
                        </span>
                        <span className="text-subtle">{delegate.email}</span>
                      </span>
                    ) : (
                      <span className="text-subtle">{row.delegateHint}</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-subtle">Keputusan pertama yang berlaku.</p>
      {canManage ? (
        <div className="flex justify-end">
          <Button
            disabled={pending}
            onClick={() => run(() => saveApproversAction(values))}
          >
            Simpan Approver
          </Button>
        </div>
      ) : null}
    </div>
  );
}
