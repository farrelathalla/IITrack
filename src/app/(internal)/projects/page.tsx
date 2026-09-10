import type { Metadata } from "next";
import Link from "next/link";
import {
  StatusBadge,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui";
import { canSeeAction } from "@/lib/auth/ui-visibility";
import {
  formatDateTimeId,
  formatProjectValue,
  stageLabel,
  visibleProjectListColumns,
} from "@/lib/project/hub-display";
import { getAuthenticatedSession } from "@/server/auth/session";
import { readProjectList } from "@/server/project/hub";

export const metadata: Metadata = {
  title: "Project",
};

export default async function ProjectListPage() {
  const session = await getAuthenticatedSession();
  const now = new Date();
  const bolehDaftar =
    session !== null && canSeeAction(session.actor, "project.create", now);
  const columns = visibleProjectListColumns(
    session?.actor ?? {
      userId: "anon",
      status: "DEACTIVATED",
      roleAssignments: [],
    },
    now,
  );
  const bolehLihatNilai = columns.some((column) => column.key === "value");

  const projects =
    session === null ? [] : await readProjectList(session.actor, now);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="text-xl">Project</h1>
          <p className="max-w-prose text-slate-500">
            Daftar project dengan nomor resmi. Buka baris untuk melihat hub:
            identitas, tahap, tim, dokumen, termin, dan riwayat dalam satu
            layar.
          </p>
        </div>
        {bolehDaftar ? (
          <Link
            href="/projects/baru"
            className="inline-flex items-center justify-center rounded-card bg-plum-900 px-4 py-2 font-semibold text-white hover:bg-plum-950"
          >
            Daftarkan project
          </Link>
        ) : null}
      </div>

      {projects.length === 0 ? (
        <p className="rounded-card border border-line bg-white px-4 py-3 text-slate-500 text-sm">
          Belum ada project.{" "}
          {bolehDaftar ? (
            <>
              <Link
                href="/projects/baru"
                className="font-medium text-plum-900 underline-offset-4 hover:underline"
              >
                Daftarkan yang pertama
              </Link>
              .
            </>
          ) : (
            "Minta COO atau PM yang berwenang untuk mendaftarkannya."
          )}
        </p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              {columns.map((column) => (
                <TableHead key={column.key}>{column.label}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {projects.map((project) => (
              <TableRow key={project.projectId}>
                {columns.map((column) => {
                  const href = `/projects/${encodeURIComponent(project.projectId)}`;
                  const cell = (() => {
                    switch (column.key) {
                      case "projectId":
                        return (
                          <span className="angka font-medium text-plum-900">
                            {project.projectId}
                          </span>
                        );
                      case "name":
                        return project.name;
                      case "client":
                        return project.clientName;
                      case "pm":
                        return project.assignedPm ?? "—";
                      case "stage":
                        return (
                          <StatusBadge status={project.stage ?? "pending"}>
                            {stageLabel(project.stage)}
                          </StatusBadge>
                        );
                      case "updatedAt":
                        return (
                          <span className="angka text-xs">
                            {formatDateTimeId(project.updatedAt)}
                          </span>
                        );
                      case "value":
                        return bolehLihatNilai
                          ? (formatProjectValue(project.value) ?? "—")
                          : "—";
                      default:
                        return null;
                    }
                  })();

                  return (
                    <TableCell key={column.key}>
                      <Link
                        href={href}
                        className="block underline-offset-2 hover:underline"
                      >
                        {cell}
                      </Link>
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
