"use client";

import { Check, Minus } from "lucide-react";
import { useState } from "react";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { ROLE_LABELS, ROLE_ORDER } from "@/lib/auth/roles";
import type { RoleName } from "@/lib/auth/types";
import {
  PERMISSION_ACTIONS,
  PERMISSION_AREAS,
  ROLE_PERMISSIONS,
} from "@/lib/settings";
import { cn } from "@/lib/utils";

/**
 * Matriks izin per jabatan (PRD bab 8.7). Isinya diturunkan dari aturan yang
 * ditegakkan server, jadi halaman ini menampilkan, bukan mengatur, izin.
 */
export function PermissionsSection() {
  const [role, setRole] = useState<RoleName>("PROJECT_MANAGER");
  const matrix = ROLE_PERMISSIONS[role];

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-muted text-xs">
          Matriks izin untuk role yang dipilih
        </p>
        <label className="flex items-center gap-2 text-xs">
          <span className="font-medium text-muted">Role:</span>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as RoleName)}
            className={cn(FIELD_CONTROL, "w-auto py-1.5 text-xs")}
          >
            {ROLE_ORDER.map((r) => (
              <option key={r} value={r}>
                {ROLE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
        <table className="w-full text-xs">
          <thead className="border-line border-b bg-surface">
            <tr>
              <th className="px-4 py-2.5 text-left font-semibold text-[11px] text-muted uppercase tracking-wider">
                Area
              </th>
              {PERMISSION_ACTIONS.map((a) => (
                <th
                  key={a}
                  className="px-3 py-2.5 text-center font-semibold text-[11px] text-muted uppercase tracking-wider"
                >
                  {a}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface">
            {PERMISSION_AREAS.map((area) => (
              <tr key={area}>
                <td className="px-4 py-3 font-medium text-ink">{area}</td>
                {PERMISSION_ACTIONS.map((action) => {
                  const grant = matrix[area][action];
                  return (
                    <td key={action} className="px-3 py-3 text-center">
                      {grant === "full" ? (
                        <Check
                          className="mx-auto size-4 text-success-text"
                          aria-label="Ya"
                        />
                      ) : grant === "limited" ? (
                        <span className="rounded-full bg-warning-bg px-2 py-0.5 font-medium text-[10px] text-warning-text">
                          terbatas
                        </span>
                      ) : (
                        <Minus
                          className="mx-auto size-4 text-faint"
                          aria-label="Tidak"
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[11px] text-subtle">
        &ldquo;Terbatas&rdquo;: hanya project yang ditugaskan atau divisinya
        sendiri.
      </p>
    </div>
  );
}
