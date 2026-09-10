"use server";

import { parseSubmissionDecisionForm } from "@/lib/finance/decision";
import { decideSubmission } from "@/server/approval/workflow";
import { getAuthenticatedSession } from "@/server/auth/session";

export interface DecideSubmissionFormState {
  error: string | null;
  fields?: Record<string, string>;
  success?: string | null;
  leftQueue?: boolean;
  savedAt?: number;
}

export async function decideSubmissionAction(
  _previous: DecideSubmissionFormState,
  formData: FormData,
): Promise<DecideSubmissionFormState> {
  const session = await getAuthenticatedSession();
  if (!session) {
    return { error: "Sesi berakhir. Silakan masuk kembali." };
  }

  const parsed = parseSubmissionDecisionForm({
    submissionId: String(formData.get("submissionId") ?? ""),
    decision: String(formData.get("decision") ?? ""),
    reason: String(formData.get("reason") ?? ""),
  });
  if (!parsed.ok) {
    return { error: parsed.reason, fields: parsed.fields };
  }

  const result = await decideSubmission({
    actor: session.actor,
    submissionId: parsed.data.submissionId,
    decision: parsed.data.decision,
    reason: parsed.data.reason,
  });

  if (!result.ok) return { error: result.reason };

  const leftQueue = result.status !== "PENDING";
  const success =
    result.status === "REJECTED"
      ? "Pengajuan ditolak. Pengaju bisa memperbaikinya tanpa kehilangan riwayat."
      : result.status === "APPROVED"
        ? "Pengajuan disetujui sampai langkah terakhir."
        : "Keputusan dicatat. Pengajuan diteruskan ke langkah berikutnya.";

  return {
    error: null,
    success,
    leftQueue,
    savedAt: Date.now(),
  };
}
