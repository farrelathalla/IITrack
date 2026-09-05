"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import {
  Alert,
  Button,
  Dialog,
  SelectField,
  TextArea,
  TextField,
} from "@/components/ui";
import { handoverRoleAction, type MemberFormState } from "./actions";

const INITIAL: MemberFormState = { error: null };

export function HandoverPanel({
  assignments,
  users,
}: {
  assignments: {
    id: string;
    label: string;
  }[];
  users: { id: string; name: string; email: string }[];
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(
    handoverRoleAction,
    INITIAL,
  );

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state.success, router]);

  return (
    <>
      <Button type="button" variant="secondary" onClick={() => setOpen(true)}>
        Serah terima jabatan
      </Button>

      <Dialog open={open} onOpenChange={setOpen} title="Serah terima jabatan">
        <form action={formAction} className="flex flex-col gap-4">
          {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
          {state.success ? <Alert tone="success">{state.success}</Alert> : null}

          <SelectField
            label="Jabatan yang diserahkan"
            name="fromRoleAssignmentId"
            required
          >
            <option value="">Pilih penetapan</option>
            {assignments.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </SelectField>

          <SelectField label="Penerima" name="toUserId" required>
            <option value="">Pilih pengurus</option>
            {users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.name} ({user.email})
              </option>
            ))}
          </SelectField>

          <TextField
            label="Berlaku sejak"
            name="effectiveAt"
            type="date"
            required
          />

          <TextField
            label="Periode jabatan baru"
            name="newPeriod"
            required
            defaultValue="2026/2027"
          />

          <TextField
            label="Selesai jabatan baru (opsional)"
            name="newEndDate"
            type="date"
          />

          <TextArea
            label="Alasan"
            name="reason"
            required
            hint="Wajib diisi supaya keputusan serah terima bisa ditelusuri."
          />

          <Button type="submit" disabled={pending}>
            {pending ? "Memproses…" : "Jalankan serah terima"}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
