"use client";

import { useState } from "react";
import {
  changePasswordAction,
  updateNameAction,
} from "@/app/(internal)/settings/actions";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, InfoRow } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/text-field";
import { useRunner } from "@/components/use-runner";

export function ProfileSection({
  name,
  email,
  roleLabel,
  period,
  division,
  active,
}: {
  name: string;
  email: string;
  roleLabel: string;
  period: string;
  division: string;
  active: boolean;
}) {
  const [dialog, setDialog] = useState<"name" | "password" | null>(null);
  const { run, pending, error, message } = useRunner();

  return (
    <Card className="p-6">
      <div className="mb-6 flex items-center gap-4">
        <Avatar name={name} size="lg" />
        <div>
          <h2 className="font-bold text-ink text-lg">{name}</h2>
          <p className="text-muted text-sm">
            {roleLabel} · Divisi {division}
          </p>
          <p className="text-subtle text-xs">{email}</p>
        </div>
      </div>
      {message ? (
        <Alert tone="success" className="mb-3">
          {message}
        </Alert>
      ) : null}
      <div className="rounded-lg border border-line px-4 py-1">
        <InfoRow label="Nama Lengkap">{name}</InfoRow>
        <InfoRow label="Email">{email}</InfoRow>
        <InfoRow label="Role">{roleLabel}</InfoRow>
        <InfoRow label="Periode Jabatan">{period}</InfoRow>
        <InfoRow label="Divisi">{division}</InfoRow>
        <InfoRow label="Status">
          <Badge tone={active ? "success" : "danger"} dot>
            {active ? "Aktif" : "Nonaktif"}
          </Badge>
        </InfoRow>
      </div>
      <div className="mt-4 flex gap-2">
        <Button onClick={() => setDialog("name")}>Edit Profil</Button>
        <Button variant="secondary" onClick={() => setDialog("password")}>
          Ganti Kata Sandi
        </Button>
      </div>
      <p className="mt-2 text-[11px] text-subtle">
        Email, jabatan, dan periode diatur Super Admin.
      </p>

      <Dialog
        open={dialog === "name"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Edit Profil"
      >
        <form
          action={(fd) =>
            run(
              () => updateNameAction(String(fd.get("name") ?? "")),
              () => setDialog(null),
            )
          }
          className="space-y-3"
        >
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <TextField
            label="Nama lengkap"
            name="name"
            required
            defaultValue={name}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              Simpan
            </Button>
          </div>
        </form>
      </Dialog>
      <Dialog
        open={dialog === "password"}
        onOpenChange={(o) => !o && setDialog(null)}
        title="Ganti Kata Sandi"
      >
        <form
          action={(fd) =>
            run(
              () =>
                changePasswordAction(
                  String(fd.get("current") ?? ""),
                  String(fd.get("next") ?? ""),
                ),
              () => setDialog(null),
            )
          }
          className="space-y-3"
        >
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <TextField
            label="Kata sandi saat ini"
            name="current"
            type="password"
            autoComplete="current-password"
            required
          />
          <TextField
            label="Kata sandi baru"
            name="next"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            hint="Minimal 8 karakter."
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDialog(null)}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              Simpan
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}
