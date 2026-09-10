"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Alert, Button, SelectField } from "@/components/ui";
import type { Division } from "@/lib/auth/types";
import { divisionLabel } from "@/lib/project/assignment-display";
import { type AssignMemberFormState, assignMemberAction } from "./actions";

const INITIAL: AssignMemberFormState = { error: null };

export type AssignableOption = {
  id: string;
  name: string;
  email: string;
};

export function AssignMemberForm({
  projectDbId,
  divisions,
  candidatesByDivision,
}: {
  projectDbId: string;
  divisions: Division[];
  candidatesByDivision: Record<Division, AssignableOption[]>;
}) {
  const router = useRouter();
  const [division, setDivision] = useState<Division | "">(divisions[0] ?? "");
  const [state, formAction, pending] = useActionState(
    assignMemberAction,
    INITIAL,
  );

  useEffect(() => {
    if (!state.savedAt) return;
    router.refresh();
  }, [state.savedAt, router]);

  const candidates = useMemo(() => {
    if (!division) return [];
    return candidatesByDivision[division] ?? [];
  }, [candidatesByDivision, division]);

  if (divisions.length === 0) {
    return (
      <Alert tone="status">
        Jabatan Anda tidak memimpin divisi mana pun untuk penugasan.
      </Alert>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-card border border-line p-3"
      autoComplete="off"
    >
      <input type="hidden" name="projectDbId" value={projectDbId} />

      <h3 className="font-medium text-plum-900 text-sm">Tugaskan pelaksana</h3>

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <SelectField
        label="Divisi"
        name="division"
        required
        value={division}
        onChange={(event) => setDivision(event.target.value as Division)}
        error={state.fields?.division}
      >
        {divisions.map((item) => (
          <option key={item} value={item}>
            {divisionLabel(item)}
          </option>
        ))}
      </SelectField>

      <SelectField
        label="Pengurus"
        name="userId"
        required
        error={state.fields?.userId}
        hint="Hanya pengurus aktif di divisi itu yang belum ditugaskan di project ini."
      >
        <option value="">Pilih pengurus…</option>
        {candidates.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name} ({member.email})
          </option>
        ))}
      </SelectField>

      {candidates.length === 0 ? (
        <Alert tone="status">
          Tidak ada pengurus yang bisa ditugaskan untuk divisi ini.
        </Alert>
      ) : null}

      <Button type="submit" disabled={pending || candidates.length === 0}>
        {pending ? "Menugaskan…" : "Tugaskan"}
      </Button>
    </form>
  );
}
