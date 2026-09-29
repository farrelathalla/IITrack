"use client";

import { Check, Copy, Link2, Plus, Search } from "lucide-react";
import { useState } from "react";
import {
  addUserAction,
  editRoleAction,
  issueInvitationAction,
  type LinkResult,
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
import { formatDate, formatDateTime } from "@/lib/time";
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
          {ROLE_LABELS[role]} ({DIVISION_LABELS[ROLE_DIVISION[role]]})
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

interface InviteInfo {
  name: string;
  email: string;
  link: string;
  reset: boolean;
}

function inviteMessage(invite: InviteInfo): string {
  return invite.reset
    ? `Halo ${invite.name}, ini link untuk mengatur ulang kata sandi IITrack kamu (berlaku 7 hari, sekali pakai):\n${invite.link}\n\nEmail login: ${invite.email}`
    : `Halo ${invite.name}, akun IITrack kamu sudah dibuat. Buka link ini untuk membuat kata sandi dan langsung masuk (berlaku 7 hari, sekali pakai):\n${invite.link}\n\nEmail login: ${invite.email}`;
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="secondary"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          window.prompt("Salin teks ini:", text);
        }
      }}
    >
      {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
      {copied ? "Tersalin" : label}
    </Button>
  );
}

/** Link undangan yang baru dibuat, siap disalin dan dikirim lewat WA/email. */
function InviteDialog({
  invite,
  onClose,
}: {
  invite: InviteInfo;
  onClose: () => void;
}) {
  const message = inviteMessage(invite);
  return (
    <Dialog
      open
      onOpenChange={(o) => !o && onClose()}
      title={invite.reset ? "Link atur ulang kata sandi" : "Link undangan siap"}
    >
      <div className="space-y-3">
        <p className="text-muted text-xs leading-relaxed">
          IITrack tidak mengirim email. Kirim link ini sendiri ke{" "}
          <strong className="text-ink">{invite.name}</strong> lewat WA atau
          email. Link berlaku 7 hari dan hanya bisa dipakai sekali; bila hilang,
          buat link baru dari tabel pengguna.
        </p>
        <input
          readOnly
          value={invite.link}
          aria-label="Link undangan"
          onFocus={(e) => e.currentTarget.select()}
          className={cn(FIELD_CONTROL, "font-mono text-[11px]")}
        />
        <pre className="whitespace-pre-wrap break-all rounded-lg bg-surface px-3 py-2 font-sans text-ink text-xs leading-relaxed">
          {message}
        </pre>
        <div className="flex justify-end gap-2">
          <CopyButton text={invite.link} label="Salin link" />
          <CopyButton text={message} label="Salin pesan" />
          <Button onClick={onClose}>Selesai</Button>
        </div>
      </div>
    </Dialog>
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
  const [invite, setInvite] = useState<InviteInfo | null>(null);

  /** Jalankan aksi yang mengembalikan link undangan, lalu tampilkan linknya. */
  function runWithLink(
    fn: () => Promise<LinkResult>,
    user: { name: string; email: string; reset: boolean },
    onSuccess?: () => void,
  ) {
    run(async () => {
      const result = await fn();
      if (result.ok && result.link) setInvite({ ...user, link: result.link });
      return result;
    }, onSuccess);
  }

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
      {error && dialog === null ? <Alert tone="danger">{error}</Alert> : null}

      <div className="overflow-x-auto rounded-xl border border-line bg-white shadow-sm">
        <table className="w-full text-left text-xs">
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
                  className="px-4 py-8 text-center text-subtle text-xs"
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
                    {u.division ? DIVISION_LABELS[u.division] : "-"}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {u.role ? (
                      ROLE_LABELS[u.role]
                    ) : u.lastRole ? (
                      <span className="text-subtle">
                        {ROLE_LABELS[u.lastRole]}
                      </span>
                    ) : (
                      "-"
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted text-xs">
                    {u.period ?? "-"}
                  </td>
                  <td className="px-4 py-3">
                    {u.active && !u.activated ? (
                      <Badge tone="warning" dot>
                        Belum aktivasi
                      </Badge>
                    ) : (
                      <Badge tone={u.active ? "success" : "neutral"} dot>
                        {u.active ? "Aktif" : "Nonaktif"}
                      </Badge>
                    )}
                    {u.active && !u.activated && u.inviteExpiresAt ? (
                      <span className="mt-0.5 block text-[10px] text-subtle">
                        Link berlaku s.d. {formatDate(u.inviteExpiresAt)}
                      </span>
                    ) : null}
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
                          {u.active && !u.activated ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={pending}
                              onClick={() =>
                                runWithLink(() => issueInvitationAction(u.id), {
                                  name: u.name,
                                  email: u.email,
                                  reset: false,
                                })
                              }
                            >
                              <Link2 className="size-3.5" />
                              Link Undangan
                            </Button>
                          ) : null}
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
            runWithLink(
              () =>
                addUserAction({
                  name: String(fd.get("name") ?? ""),
                  email: String(fd.get("email") ?? ""),
                  role: String(fd.get("role") ?? "") as RoleName,
                  periodId: String(fd.get("periodId") ?? ""),
                  password: String(fd.get("password") ?? ""),
                }),
              {
                name: String(fd.get("name") ?? ""),
                email: String(fd.get("email") ?? ""),
                reset: false,
              },
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
          <p className="rounded-lg bg-surface px-3 py-2 text-muted text-xs leading-relaxed">
            Setelah disimpan, kamu dapat <strong>link undangan</strong> untuk
            dikirim ke anggota lewat WA atau email. Anggota membuat kata
            sandinya sendiri lewat link itu.
          </p>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted hover:text-ink">
              Atau isi kata sandi awal sendiri
            </summary>
            <div className="mt-2">
              <TextField
                label="Kata sandi awal (opsional)"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                hint="Kosongkan untuk memakai link undangan."
              />
            </div>
          </details>
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
              {dialog.user.role ? ROLE_LABELS[dialog.user.role] : "-"}
            </InfoRow>
            <InfoRow label="Divisi">
              {dialog.user.division
                ? DIVISION_LABELS[dialog.user.division]
                : "-"}
            </InfoRow>
            <InfoRow label="Periode">{dialog.user.period ?? "-"}</InfoRow>
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
          {error ? (
            <Alert tone="danger" className="mt-3">
              {error}
            </Alert>
          ) : null}
          {canManage && dialog.user.active ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                disabled={pending}
                onClick={() =>
                  runWithLink(
                    () => issueInvitationAction(dialog.user.id),
                    {
                      name: dialog.user.name,
                      email: dialog.user.email,
                      reset: dialog.user.activated,
                    },
                    close,
                  )
                }
              >
                <Link2 className="size-3.5" />
                {dialog.user.activated
                  ? "Buat Link Atur Ulang Kata Sandi"
                  : "Buat Link Undangan Baru"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setDialog({ kind: "password", user: dialog.user })
                }
              >
                Isi Kata Sandi Manual
              </Button>
            </div>
          ) : null}
        </Dialog>
      ) : null}

      {dialog?.kind === "role" ? (
        <Dialog
          open
          onOpenChange={(o) => !o && close()}
          title={`Edit Role: ${dialog.user.name}`}
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
              Akses lama langsung diganti akses baru.
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
          title={`Cabut Akses: ${dialog.user.name}`}
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
              Akun langsung logout dan tidak bisa masuk lagi. Riwayatnya tetap
              tersimpan.
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
          title={`Atur Ulang Kata Sandi: ${dialog.user.name}`}
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
      {invite ? (
        <InviteDialog invite={invite} onClose={() => setInvite(null)} />
      ) : null}
    </div>
  );
}
