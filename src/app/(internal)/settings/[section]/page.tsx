import { Lock } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { type AccessRow, AccessSection } from "@/components/settings/access";
import { PermissionsSection } from "@/components/settings/permissions";
import { ProfileSection } from "@/components/settings/profile";
import { type PeriodView, SystemSection } from "@/components/settings/system";
import { UsersSection } from "@/components/settings/users";
import {
  type WorkflowRow,
  WorkflowSection,
} from "@/components/settings/workflow";
import { canGlobally } from "@/lib/auth/access";
import {
  DIVISION_LABELS,
  isFinanceLead,
  isOpsLead,
  isTechLead,
  ROLE_DIVISION,
  ROLE_LABELS,
} from "@/lib/auth/roles";
import type { RoleName } from "@/lib/auth/types";
import {
  isSettingsSection,
  SETTINGS_SECTIONS,
  visibleSections,
} from "@/lib/settings";
import { formatDate } from "@/lib/time";
import {
  activeUsersByRoles,
  listPeriods,
  listUsers,
} from "@/server/admin/users";
import { requireUser } from "@/server/auth/current";
import { prisma } from "@/server/db";
import {
  APPROVAL_KIND_INFO,
  APPROVAL_KINDS,
  getSettings,
} from "@/server/settings";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ section: string }>;
}): Promise<Metadata> {
  const { section } = await params;
  return {
    title:
      SETTINGS_SECTIONS.find((s) => s.id === section)?.label ?? "Pengaturan",
  };
}

const APPROVER_ROLES: Record<
  string,
  { primary: RoleName[]; delegate: RoleName[] }
> = {
  PROJECT_CHARTER: { primary: ["COO"], delegate: ["VICE_COO"] },
  MOU: { primary: ["COO"], delegate: ["VICE_COO"] },
  PROGRAMMER_CONTRACT: { primary: ["CTO"], delegate: ["VICE_CTO"] },
  INVOICE: { primary: ["FINANCE_POC"], delegate: ["CFO", "VICE_CFO"] },
  DISBURSEMENT: { primary: ["CFO"], delegate: ["VICE_CFO"] },
};

export default async function SettingsSectionPage({
  params,
}: {
  params: Promise<{ section: string }>;
}) {
  const { section } = await params;
  if (!isSettingsSection(section)) notFound();

  const { actor, viewer } = await requireUser();
  const role = viewer.role;
  if (!visibleSections(role).includes(section)) {
    return (
      <div className="rounded-xl border border-line bg-white p-8 text-center shadow-sm">
        <Lock className="mx-auto mb-3 size-8 text-faint" />
        <p className="font-semibold text-ink">Akses Dibatasi</p>
        <p className="mt-1 text-muted text-xs">
          Halaman ini tidak tersedia untuk jabatanmu.
        </p>
      </div>
    );
  }
  const canManage = canGlobally(viewer, "settings.manage").allowed;

  switch (section) {
    case "profile": {
      const users = await listUsers();
      const me = users.find((u) => u.id === actor.userId);
      return (
        <ProfileSection
          name={actor.name}
          email={me?.email ?? ""}
          roleLabel={role ? ROLE_LABELS[role] : "-"}
          period={me?.period ?? "-"}
          division={role ? DIVISION_LABELS[ROLE_DIVISION[role]] : "-"}
          active={role !== null}
        />
      );
    }
    case "users": {
      const [users, periods] = await Promise.all([listUsers(), listPeriods()]);
      // C-Level hanya melihat anggota divisinya; disaring di server.
      const visible = canManage
        ? users
        : users.filter((u) => role && u.division === ROLE_DIVISION[role]);
      return (
        <UsersSection
          users={visible}
          periods={periods.map((p) => ({ id: p.id, name: p.name }))}
          canManage={canManage}
          selfId={actor.userId}
        />
      );
    }
    case "permissions":
      return <PermissionsSection />;
    case "workflow": {
      const settings = await getSettings();
      const rows: WorkflowRow[] = await Promise.all(
        APPROVAL_KINDS.map(async (kind) => {
          const info = APPROVAL_KIND_INFO[kind];
          const roles = APPROVER_ROLES[kind];
          return {
            kind,
            label: info.label,
            approverLabel: info.approverLabel,
            primaryHint: info.primaryHint,
            delegateHint: info.delegateHint,
            primaryFixed: kind === "INVOICE",
            primaryOptions: await activeUsersByRoles(roles.primary),
            delegateOptions: await activeUsersByRoles(roles.delegate),
            value: settings.approvers[kind],
          };
        }),
      );
      return <WorkflowSection rows={rows} canManage={canManage} />;
    }
    case "access": {
      const projects = await prisma.project.findMany({
        where: { closedAt: null },
        orderBy: { createdAt: "desc" },
        select: {
          code: true,
          name: true,
          client: true,
          assignments: {
            where: { endedAt: null },
            select: { role: true, user: { select: { name: true } } },
          },
        },
      });
      const rows: AccessRow[] = projects.map((p) => ({
        code: p.code,
        name: p.name,
        client: p.client,
        pm: p.assignments
          .filter((a) => a.role === "PM")
          .map((a) => a.user.name),
        developers: p.assignments
          .filter((a) => a.role === "DEVELOPER")
          .map((a) => a.user.name),
        financePoc: p.assignments
          .filter((a) => a.role === "FINANCE_POC")
          .map((a) => a.user.name),
      }));
      const manageTab = isOpsLead(role)
        ? "pm"
        : isTechLead(role)
          ? "tech"
          : isFinanceLead(role)
            ? "finance"
            : null;
      return <AccessSection rows={rows} manageTab={manageTab} />;
    }
    case "system": {
      const [periods, settings] = await Promise.all([
        listPeriods(),
        getSettings(),
      ]);
      const now = new Date();
      const views: PeriodView[] = periods.map((p) => ({
        id: p.id,
        name: p.name,
        code: p.code,
        start: formatDate(p.startDate),
        end: formatDate(p.endDate),
        status:
          p.startDate > now
            ? "Akan Datang"
            : p.endDate <= now
              ? "Berakhir"
              : "Aktif",
      }));
      return (
        <SystemSection
          periods={views}
          projectIdFormat={settings.projectIdFormat}
          tolerance={settings.finalStatusToleranceDays}
        />
      );
    }
  }
}
