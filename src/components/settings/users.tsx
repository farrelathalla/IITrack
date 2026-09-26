"use client";

import { Plus, Search } from "lucide-react";
import { useState } from "react";
import {
  addUserAction,
  editRoleAction,
  resetPasswordAction,
  revokeAccessAction,
} from "@/app/(internal)/settings/actions";
import { Alert } from "@/components/ui/alert";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { InfoRow } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { FIELD_CONTROL } from "@/components/ui/field-styles";
import { SelectField } from "@/components/ui/select-field";
import { TextArea } from "@/components/ui/text-area";
import { TextField } from "@/components/ui/text-field";
import { useRunner } from "@/components/use-runner";
import {
  DIVISION_LABELS,
  ROLE_DIVISION,
  ROLE_LABELS,
  ROLE_ORDER,
} from "@/lib/auth/roles";
import type { RoleName } from "@/lib/auth/types";
import { formatDateTime } from "@/lib/time";
import { cn } from "@/lib/utils";
import type { UserRow } from "@/server/admin/users";

interface PeriodOption {
  id: string;
  name: string;
}

type DialogState =
  | { kind: "add" }
  | { kind: "view"; user: UserRow }
  | { kind: "role"; user: UserRow }
  | { kind: "revoke"; user: UserRow }
  | { kind: "password"; user: UserRow }
  | null;

function RoleSelect({ defaultValue }: { defaultValue?: RoleName | null }) {
  return (
    <SelectField
      label="Jabatan"
      name="role"
      required
      defaultValue={defaultValue ?? ""}
    >
      <option value="" disabled>
        Pilih jabatan…
      </option>
      {ROLE_ORDER.map((role) => (
        <option key={role} value={role}>
          {ROLE_LABELS[role]} — {DIVISION_LABELS[ROLE_DIVISION[role]]}
        </option>
      ))}
    </SelectField>
  );
}

function PeriodSelect({
  periods,
  defaultValue,
}: {
  periods: PeriodOption[];
  defaultValue?: string | null;
}) {
  return (
    <SelectField
      label="Periode jabatan"
      name="periodId"
      required
      defaultValue={defaultValue ?? periods[0]?.id ?? ""}
    >
      {periods.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </SelectField>
  );
}

/**
 * Users & Roles (PRD bab 2.5 dan 8.7). Super Admin menambah, mengubah
 * jabatan, dan mencabut akses; C-Level hanya melihat divisinya.
 */
export function UsersSection({
  users,
  periods,
  canManage,
  selfId,
}: {
  users: UserRow[];
  periods: PeriodOption[];
  canManage: boolean;
  selfId: string;
}) {
  const [query, setQuery] = useState("");
  const [period, setPeriod] = useState("");
  const [status, setStatus] = useState("");
  const [dialog, setDialog] = useState<DialogState>(null);
  const { run, pending, error, message } = useRunner();

  const filtered = users.filter((u) => {
    const q = query.trim().toLowerCase();
    if (q && !`${u.name} ${u.email}`.toLowerCase().includes(q)) return false;
    if (period && u.period !== period) return false;
    if (status === "active" && !u.active) return false;
    if (status === "inactive" && u.active) return false;
    return true;
  });
  const close = () => setDialog(null);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="-translate-y-1/2 absolute top-1/2 left-3 size-4 text-subtle" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama atau email..."
              aria-label="Cari nama atau email"
              className={cn(FIELD_CONTROL, "w-60 py-1.5 pl-9")}
            />
          </div>
          <select
            aria-label="Filter periode"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className={cn(FIELD_CONTROL, "w-auto py-1.5 text-xs")}
          >
            <option value="">Semua Periode</option>
            {periods.map((p) => (
              <option key={p.id} value={p.name}>
                {p.name}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter status"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className={cn(FIELD_CONTROL, "w-auto py-1.5 text-xs")}
          >
            <option value="">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
        </div>
        {canManage ? (
          <Button onClick={() => setDialog({ kind: "add" })}>
            <Plus className="size-4" />
            Tambah User
          </Button>
        ) : null}
      </div>
      {message ? <Alert tone="success">{message}</Alert> : null}

      <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
        <table className="w-full text-left text-sm">
          <thead className="border-line border-b bg-surface">
            <tr>
              {[
                "Nama",
                "Email",
                "Divisi",
                "Role",
                "Periode",
                "Status",
                "Aksi",
              ].map((h) => (
                <th
                  key={h}
                  className="whitespace-nowrap px-4 py-2.5 font-semibold text-[11px] text-muted uppercase tracking-wider"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-surface">
            {filtered.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-subtle text-sm"
                >
                  Tidak ada pengguna yang cocok.
                </td>
              </tr>
            ) : (
              filtered.map((u) => (
                <tr key={u.id}>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <Avatar name={u.name} />
                      <span className="font-medium text-ink">{u.name}</span>
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">{u.email}</td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {u.division ? DIVISION_LABELS[u.division] : "—"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {u.role ? (
                      ROLE_LABELS[u.role]
                    ) : u.lastRole ? (
                      <span className="text-subtle">
                        {ROLE_LABELS[u.lastRole]}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {u.period ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={u.active ? "success" : "neutral"} dot>
                      {u.active ? "Aktif" : "Nonaktif"}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDialog({ kind: "view", user: u })}
                      >
                        Lihat
                      </Button>
                      {canManage ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDialog({ kind: "role", user: u })}
                          >
                            Edit Role
                          </Button>
                          {u.active && u.id !== selfId ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-danger-text hover:bg-danger-bg hover:text-danger-text"
                              onClick={() =>
                                setDialog({ kind: "revoke", user: u })
                              }
                            >
                              Cabut Akses
                            </Button>
                          ) : null}
                        </>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p className="text-subtle text-xs">
        {filtered.length} pengguna ditampilkan
      </p>

      <Dialog
        open={dialog?.kind === "add"}
        onOpenChange={(o) => !o && close()}
        title="Tambah User"
      >
        <form
          action={(fd) =>
            run(
              () =>
                addUserAction({
                  name: String(fd.get("name") ?? ""),
                  email: String(fd.get("email") ?? ""),
                  role: String(fd.get("role") ?? "") as RoleName,
                  periodId: String(fd.get("periodId") ?? ""),
                  password: String(fd.get("password") ?? ""),
                }),
              close,
            )
          }
          className="space-y-3"
        >
          {error ? <Alert tone="danger">{error}</Alert> : null}
          <TextField label="Nama" name="name" required />
          <TextField label="Email IIT" name="email" type="email" required />
          <RoleSelect />
          <PeriodSelect periods={periods} />
          <TextField
            label="Kata sandi awal"
            name="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            hint="Sampaikan ke pemilik akun. Ia bisa menggantinya di Pengaturan > Profil."
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={close}>
              Batal
            </Button>
            <Button type="submit" disabled={pending}>
              Simpan
            </Button>
          </div>
        </form>
      </Dialog>

      {dialog?.kind === "view" ? (
        <Dialog
          open
          onOpenChange={(o) => !o && close()}
          title={dialog.user.name}
        >
          <div className="rounded-lg border border-line px-4 py-1">
            <InfoRow label="Email">{dialog.user.email}</InfoRow>
            <InfoRow label="Jabatan">
              {dialog.user.role ? ROLE_LABELS[dialog.user.role] : "—"}
            </InfoRow>
            <InfoRow label="Divisi">
              {dialog.user.division
                ? DIVISION_LABELS[dialog.user.division]
                : "—"}
            </InfoRow>
            <InfoRow label="Periode">{dialog.user.period ?? "—"}</InfoRow>
            <InfoRow label="Status">
              {dialog.user.active ? "Aktif" : "Nonaktif"}
            </InfoRow>
            {dialog.user.revokedAt ? (
              <InfoRow label="Dicabut">
                {formatDateTime(dialog.user.revokedAt)}
              </InfoRow>
            ) : null}
            {dialog.user.revokeReason ? (
              <InfoRow label="Alasan">{dialog.user.revokeReason}</InfoRow>
            ) : null}
          </div>
          {canManage ? (
            <Button
              variant="secondary"
              size="sm"
              className="mt-3"
              onClick={() => setDialog({ kind: "password", user: dialog.user })}
            >
              Atur Ulang Kata Sandi
            </Button>
          ) : null}
        </Dialog>
      ) : null}

      {dialog?.kind === "role" ? (
        <Dialog
          open
          onOpenChange={(o) => !o && close()}
          title={`Edit Role — ${dialog.user.name}`}
        >
          <form
            action={(fd) =>
              run(
                () =>
                  editRoleAction({
                    userId: dialog.user.id,
                    role: String(fd.get("role") ?? "") as RoleName,
                    periodId: String(fd.get("periodId") ?? ""),
                  }),
                close,
              )
            }
            className="space-y-3"
          >
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <RoleSelect
              defaultValue={dialog.user.role ?? dialog.user.lastRole}
            />
            <PeriodSelect
              periods={periods}
              defaultValue={dialog.user.periodId}
            />
            <p className="text-subtle text-xs">
              Hak akses lama berakhir dan hak akses baru berlaku seketika.
              Project yang penugasannya tidak lagi cocok akan ditandai Perlu
              Penugasan Ulang.
            </p>
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                Simpan
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {dialog?.kind === "revoke" ? (
        <Dialog
          open
          onOpenChange={(o) => !o && close()}
          title={`Cabut Akses — ${dialog.user.name}`}
        >
          <form
            action={(fd) =>
              run(
                () =>
                  revokeAccessAction(
                    dialog.user.id,
                    String(fd.get("reason") ?? ""),
                  ),
                close,
              )
            }
            className="space-y-3"
          >
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <Alert tone="warning">
              Sesi akun berakhir seketika dan akun tidak bisa login. Riwayat
              aktivitasnya tetap tersimpan.
            </Alert>
            <TextArea label="Alasan" name="reason" required rows={3} />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>
                Batal
              </Button>
              <Button type="submit" variant="danger" disabled={pending}>
                Konfirmasi
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}

      {dialog?.kind === "password" ? (
        <Dialog
          open
          onOpenChange={(o) => !o && close()}
          title={`Atur Ulang Kata Sandi — ${dialog.user.name}`}
        >
          <form
            action={(fd) =>
              run(
                () =>
                  resetPasswordAction(
                    dialog.user.id,
                    String(fd.get("password") ?? ""),
                  ),
                close,
              )
            }
            className="space-y-3"
          >
            {error ? <Alert tone="danger">{error}</Alert> : null}
            <TextField
              label="Kata sandi baru"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
              hint="Semua sesi akun ini akan berakhir."
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={close}>
                Batal
              </Button>
              <Button type="submit" disabled={pending}>
                Simpan
              </Button>
            </div>
          </form>
        </Dialog>
      ) : null}
    </div>
  );
}
