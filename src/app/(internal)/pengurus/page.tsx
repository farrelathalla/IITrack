import type { Metadata } from "next";
import Link from "next/link";
import {
  Alert,
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { canSeeAction } from "@/lib/auth/ui-visibility";
import { formatDateId } from "@/lib/member/ui";
import { getAuthenticatedSession } from "@/server/auth/session";
import { listMembersWithRoles } from "@/server/member/list";
import { AssignRoleForm } from "./assign-role-form";
import { HandoverPanel } from "./handover-panel";

export const metadata: Metadata = {
  title: "Pengurus",
};

export default async function PengurusPage() {
  const session = await getAuthenticatedSession();
  const bolehKelola =
    session !== null &&
    canSeeAction(session.actor, "user.manage_role_assignment");

  const members = await listMembersWithRoles();
  const activeUsers = members
    .filter((member) => member.status === "ACTIVE")
    .map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
    }));

  const assignmentOptions = members.flatMap((member) =>
    member.roleAssignments.map((assignment) => ({
      id: assignment.id,
      label: `${member.name} — ${assignment.role} (${assignment.period})`,
    })),
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-1">
        <p className="text-slate-500 text-xs">
          <Link href="/beranda" className="underline-offset-4 hover:underline">
            Beranda
          </Link>
          {" / "}
          Pengurus
        </p>
        <h1 className="text-xl">Pengurus & jabatan</h1>
        <p className="max-w-prose text-slate-500">
          Daftar anggota, penetapan jabatan, dan serah terima dalam satu langkah
          (F07). Izin menempel pada masa jabatan, bukan pada orangnya.
        </p>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base">Daftar pengurus</h2>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nama</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Jabatan</TableHead>
              <TableHead>Periode</TableHead>
              <TableHead>Berlaku</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {members.map((member) =>
              member.roleAssignments.length === 0 ? (
                <TableRow key={member.id}>
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-medium text-plum-900">
                        {member.name}
                      </span>
                      <span className="text-slate-500 text-xs">
                        {member.email}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StatusBadge status={member.status}>
                      {member.status}
                    </StatusBadge>
                  </TableCell>
                  <TableCell colSpan={3} className="text-slate-500">
                    Belum ada penetapan jabatan
                  </TableCell>
                </TableRow>
              ) : (
                member.roleAssignments.map((assignment, index) => (
                  <TableRow key={assignment.id}>
                    <TableCell>
                      {index === 0 ? (
                        <div className="flex flex-col">
                          <span className="font-medium text-plum-900">
                            {member.name}
                          </span>
                          <span className="text-slate-500 text-xs">
                            {member.email}
                          </span>
                        </div>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      {index === 0 ? (
                        <StatusBadge status={member.status}>
                          {member.status}
                        </StatusBadge>
                      ) : null}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <span>{assignment.role}</span>
                        <span className="text-slate-500 text-xs">
                          {assignment.division}
                          {assignment.isSystemAdmin ? " · System Admin" : ""}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>{assignment.period}</TableCell>
                    <TableCell className="angka text-xs">
                      {formatDateId(assignment.startDate)}
                      {" → "}
                      {formatDateId(assignment.endDate)}
                    </TableCell>
                  </TableRow>
                ))
              ),
            )}
          </TableBody>
        </Table>
      </section>

      {bolehKelola ? (
        <div className="grid gap-6 lg:grid-cols-2">
          <section className="flex flex-col gap-3 rounded-card border border-line bg-white p-5">
            <h2 className="text-base">Tetapkan jabatan</h2>
            <AssignRoleForm users={activeUsers} />
          </section>
          <section className="flex flex-col gap-3 rounded-card border border-line bg-white p-5">
            <h2 className="text-base">Serah terima</h2>
            <p className="text-slate-500 text-sm">
              Menutup masa jabatan lama dan membuka yang baru pada saat yang
              sama, lalu mencabut sesi pemegang lama.
            </p>
            <HandoverPanel
              assignments={assignmentOptions}
              users={activeUsers}
            />
          </section>
        </div>
      ) : (
        <Alert tone="status">
          Formulir penetapan dan serah terima hanya untuk pemegang System
          Administrator privilege. Anda masih bisa melihat daftar pengurus.
        </Alert>
      )}
    </div>
  );
}
