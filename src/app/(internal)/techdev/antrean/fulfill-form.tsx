"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { Alert, Button } from "@/components/ui";
import {
  type FulfillStaffingFormState,
  fulfillStaffingAction,
} from "./actions";

const INITIAL: FulfillStaffingFormState = { error: null };

export function FulfillStaffingForm({
  requestId,
  members,
}: {
  requestId: string;
  members: Array<{ id: string; name: string; email: string }>;
}) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    fulfillStaffingAction,
    INITIAL,
  );

  useEffect(() => {
    if (!state.savedAt) return;
    router.refresh();
  }, [state.savedAt, router]);

  if (members.length === 0) {
    return (
      <Alert tone="status">
        Belum ada anggota TechDev aktif yang bisa ditetapkan.
      </Alert>
    );
  }

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3"
      autoComplete="off"
    >
      <input type="hidden" name="requestId" value={requestId} />

      {state.error ? <Alert tone="danger">{state.error}</Alert> : null}
      {state.success ? <Alert tone="success">{state.success}</Alert> : null}

      <fieldset className="flex flex-col gap-2">
        <legend className="font-medium text-plum-900 text-sm">
          Pilih anggota
        </legend>
        {members.map((member) => (
          <label key={member.id} className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              name="memberUserIds"
              value={member.id}
              className="mt-1"
            />
            <span>
              {member.name}
              <span className="block text-slate-500 text-xs">
                {member.email}
              </span>
            </span>
          </label>
        ))}
      </fieldset>

      <Button type="submit" disabled={pending}>
        {pending ? "Menetapkan…" : "Tetapkan anggota"}
      </Button>
    </form>
  );
}
