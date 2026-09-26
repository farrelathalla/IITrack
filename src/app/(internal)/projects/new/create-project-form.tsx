"use client";

import { CheckCircle2, Info } from "lucide-react";
import Link from "next/link";
import { useActionState } from "react";
import { PersonPicker } from "@/components/project/person-picker";
import {
  Alert,
  Button,
  Card,
  Dialog,
  SelectField,
  TextArea,
  TextField,
} from "@/components/ui";
import {
  PROJECT_SOURCE_LABELS,
  PROJECT_TYPE_LABELS,
} from "@/lib/project/catalog";
import type { Candidate } from "@/server/project/people";
import { type CreateProjectState, createProjectAction } from "./actions";

const INITIAL: CreateProjectState = { status: "idle" };

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="space-y-4 p-5">
      <h2 className="font-bold text-ink text-sm">{title}</h2>
      {children}
    </Card>
  );
}

export function CreateProjectForm({
  pmCandidates,
  nextId,
}: {
  pmCandidates: Candidate[];
  nextId: string | null;
}) {
  const [state, formAction, pending] = useActionState(
    createProjectAction,
    INITIAL,
  );
  const fields = state.status === "error" ? (state.fields ?? {}) : {};

  return (
    <>
      <form action={formAction} className="space-y-4">
        {state.status === "error" ? (
          <Alert tone="danger">{state.error}</Alert>
        ) : null}

        <Card className="flex items-center justify-between gap-4 bg-plum-50 p-4">
          <div>
            <p className="font-semibold text-[11px] text-muted uppercase tracking-wider">
              Project ID (Sistem)
            </p>
            <p className="font-bold font-mono text-lg text-plum-600">
              {nextId ?? "Belum ada periode aktif"}
            </p>
          </div>
          <p className="max-w-sm text-right text-muted text-xs">
            Format IIT-[periode]-[3 digit]. Nomor final diterbitkan saat project
            dibuat, berurutan dan unik.
          </p>
        </Card>

        <Section title="Informasi Dasar">
          <TextField
            label="Nama Project"
            name="name"
            required
            placeholder="contoh: Pharmanova Internal Platform"
            error={fields.name}
          />
          <TextField
            label="Client"
            name="client"
            required
            placeholder="contoh: PT Pharmanova Nusantara"
            error={fields.client}
          />
          <div className="grid grid-cols-2 gap-4">
            <SelectField
              label="Tipe Project"
              name="type"
              defaultValue=""
              error={fields.type}
            >
              <option value="">Pilih tipe…</option>
              {Object.entries(PROJECT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Sumber Project"
              name="source"
              defaultValue=""
              error={fields.source}
            >
              <option value="">Pilih sumber…</option>
              {Object.entries(PROJECT_SOURCE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>
        </Section>

        <Section title="Penugasan Project Manager">
          <PersonPicker
            name="pmUserId"
            label="Project Manager"
            placeholder="Pilih Project Manager…"
            candidates={pmCandidates}
            error={fields.pmUserId}
          />
          <p className="flex items-start gap-1.5 text-muted text-xs">
            <Info className="mt-0.5 size-3.5 shrink-0 text-plum-500" />
            PM yang dipilih akan mendapatkan akses edit ke bagian Project
            Management untuk project ini.
          </p>
        </Section>

        <Section title="Timeline">
          <div className="grid grid-cols-2 gap-4">
            <TextField
              label="Target Mulai"
              name="targetStart"
              type="date"
              required
              error={fields.targetStart}
            />
            <TextField
              label="Target Selesai"
              name="targetEnd"
              type="date"
              required
              error={fields.targetEnd}
            />
          </div>
        </Section>

        <Section title="Catatan (Opsional)">
          <TextArea
            label="Catatan Internal"
            name="internalNote"
            rows={3}
            placeholder="Catatan untuk tim internal terkait project ini…"
          />
        </Section>

        <div className="flex items-center justify-between gap-4">
          <p className="max-w-lg text-subtle text-xs">
            Setelah project dibuat, PM yang ditugaskan akan dapat mengisi detail
            project di halaman Project Detail. Workflow dimulai dari Stage 1
            secara otomatis.
          </p>
          <div className="flex gap-2">
            <Link
              href="/projects"
              className="pressable rounded-lg border border-line bg-white px-4 py-2 font-semibold text-muted text-sm hover:bg-surface"
            >
              Batal
            </Link>
            <Button type="submit" disabled={pending || !nextId}>
              {pending ? "Membuat…" : "Buat Project →"}
            </Button>
          </div>
        </div>
      </form>

      <Dialog
        open={state.status === "created"}
        onOpenChange={() => {}}
        title="Project berhasil dibuat."
      >
        {state.status === "created" ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 rounded-lg bg-success-bg p-3">
              <CheckCircle2 className="size-6 text-success-text" />
              <div className="text-sm">
                <p className="font-bold font-mono text-ink">{state.code}</p>
                <p className="text-muted text-xs">PM: {state.pmName}</p>
              </div>
            </div>
            <p className="text-muted text-xs">
              PM sudah menerima notifikasi dan bisa mulai mengisi Stage 1.
            </p>
            <div className="flex justify-end gap-2">
              <Link
                href="/projects"
                className="pressable rounded-lg border border-line px-4 py-2 font-semibold text-muted text-sm hover:bg-surface"
              >
                Ke Semua Project
              </Link>
              <Link
                href={`/projects/${state.code}`}
                className="pressable rounded-lg bg-plum-600 px-4 py-2 font-semibold text-sm text-white hover:bg-plum-700"
              >
                Buka Project
              </Link>
            </div>
          </div>
        ) : null}
      </Dialog>
    </>
  );
}
