import type { Metadata } from "next";
import { PmAssignmentSla } from "@/components/sla/pm-assignment-sla";
import { StatusBadge } from "@/components/ui";
import { canSeeAction } from "@/lib/auth/ui-visibility";
import { getAuthenticatedSession } from "@/server/auth/session";
import { listProjectsWithPmSla } from "@/server/project/sla-display";

export const metadata: Metadata = {
  title: "Beranda",
};

export default async function BerandaPage() {
  // Layout internal sudah menolak permintaan tanpa sesi yang sah.
  const session = await getAuthenticatedSession();
  const roles = session?.actor.roleAssignments.map((a) => a.role) ?? [];
  const projects = await listProjectsWithPmSla();
  const bolehDaftar =
    session !== null && canSeeAction(session.actor, "project.create");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <h1 className="text-xl">Beranda</h1>

        <p className="max-w-prose text-slate-500">
          Project Hub (F08) tersedia di menu{" "}
          <a
            href="/projects"
            className="font-medium text-plum-900 underline-offset-4 hover:underline"
          >
            Project
          </a>
          . Ringkasan SLA penugasan PM (F04) muncul di bawah bila datanya sudah
          ada.
          {bolehDaftar ? (
            <>
              {" "}
              Anda dapat{" "}
              <a
                href="/projects/baru"
                className="font-medium text-plum-900 underline-offset-4 hover:underline"
              >
                mendaftarkan project baru
              </a>{" "}
              untuk menerbitkan Project ID.
            </>
          ) : null}
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-slate-500">Jabatan aktif:</span>
          {roles.map((role) => (
            <StatusBadge key={role} tone="running">
              {role}
            </StatusBadge>
          ))}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <h2 className="text-base">SLA penugasan PM</h2>
        {projects.length === 0 ? (
          <p className="rounded-card border border-line bg-white px-4 py-3 text-slate-500 text-sm">
            Belum ada project dengan waktu konfirmasi client atau penugasan PM.
            Setelah COO menugaskan PM (F04), selisih terhadap ambang enam jam
            kerja akan muncul di sini.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
            {projects.map((project) => (
              <li key={project.id}>
                <PmAssignmentSla
                  projectId={project.projectId}
                  pmName={project.assignedPm?.name}
                  clientConfirmedAt={project.clientConfirmedAt}
                  pmAssignedAt={project.pmAssignedAt}
                />
                <p className="mt-1 text-slate-500 text-xs">{project.name}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
