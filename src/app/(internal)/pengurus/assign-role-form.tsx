"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useMemo, useState } from "react";
import { Alert, Button, SelectField, TextField } from "@/components/ui";
import type { RoleName } from "@/lib/auth/types";
import {
  DIVISION_OPTIONS,
  defaultDivisionForRole,
  ROLE_OPTIONS,
} from "@/lib/member/ui";
import { assignRoleAction, type MemberFormState } from "./actions";

const INITIAL: MemberFormState = { error: null };

export function AssignRoleForm({
  users,
}: {
  users: { id: string; name: string; email: string }[];
}) {
  const router = useRouter();
  const [role, setRole] = useState<RoleName>("PROJECT_MANAGER");
  const [state, formAction, pending] = useActionState(
    assignRoleAction,
    INITIAL,
  );

  const defaultDivision = useMemo(() => defaultDivisionForRole(role), [role]);

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <form action={formAction} className="flex flex-col gap-4">
      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <SelectField label="Pengurus" name="userId" required>
        <option value="">Pilih pengurus</option>
        {users.map((user) => (
          <option key={user.id} value={user.id}>
            {user.name} ({user.email})
          </option>
        ))}
      </SelectField>

      <SelectField
        label="Jabatan"
        name="role"
        required
        value={role}
        onChange={(event) => setRole(event.target.value as RoleName)}
      >
        {ROLE_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>

      <SelectField
        key={defaultDivision}
        label="Divisi"
        name="division"
        required
        defaultValue={defaultDivision}
      >
        {DIVISION_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </SelectField>

      <TextField
        label="Label periode"
        name="period"
        required
        defaultValue="2026/2027"
        hint="Contoh 2026/2027 — label kepengurusan, bukan digit Project ID."
      />

      <TextField label="Mulai" name="startDate" type="date" required />
      <TextField
        label="Selesai (opsional)"
        name="endDate"
        type="date"
        hint="Kosongkan bila belum ditentukan. Tanggal selesai bersifat eksklusif."
      />

      <label className="flex items-center gap-2 text-sm text-ink">
        <input type="checkbox" name="isSystemAdmin" className="size-4" />
        System Administrator privilege
      </label>

      <Button type="submit" disabled={pending}>
        {pending ? "Menyimpan…" : "Tetapkan jabatan"}
      </Button>
    </form>
  );
}
