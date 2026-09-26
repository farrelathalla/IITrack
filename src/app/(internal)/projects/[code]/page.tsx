import type { Metadata } from "next";
import Link from "next/link";
import { ProjectDetail } from "@/components/project/detail/project-detail";
import { requireUser } from "@/server/auth/current";
import { prisma } from "@/server/db";
import { projectActivity } from "@/server/project/queries";
import { loadProjectView } from "@/server/project/view";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ code: string }>;
}): Promise<Metadata> {
  const { code } = await params;
  const project = await prisma.project.findUnique({
    where: { code },
    select: { name: true },
  });
  return { title: project?.name ?? "Project" };
}

/**
 * Project Detail (PRD bab 8.3). Semua akun aktif bisa membuka project mana
 * pun; bagian yang tidak boleh diedit tampil read-only, dan nominal serta
 * tautan yang dibatasi sudah dihapus di server sebelum dikirim.
 */
export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const { viewer } = await requireUser();
  const view = await loadProjectView(decodeURIComponent(code), viewer);

  if (!view) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border border-line bg-white p-8 text-center shadow-sm">
          <p className="font-semibold text-ink">Project tidak ditemukan.</p>
          <Link
            href="/projects"
            className="mt-3 inline-block font-medium text-plum-600 text-sm hover:underline"
          >
            Kembali ke Semua Project
          </Link>
        </div>
      </div>
    );
  }

  const activity = await projectActivity(view.project.id);
  return <ProjectDetail view={view} activity={activity} />;
}
