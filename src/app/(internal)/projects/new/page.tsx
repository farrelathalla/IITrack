import { ChevronRight, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { canGlobally } from "@/lib/auth/access";
import { requireUser } from "@/server/auth/current";
import { previewNextProjectId } from "@/server/project/create";
import { candidatesFor } from "@/server/project/people";
import { CreateProjectForm } from "./create-project-form";

export const metadata: Metadata = { title: "Tambah Project" };

export default async function NewProjectPage() {
  const { viewer } = await requireUser();
  const decision = canGlobally(viewer, "project.create");

  if (!decision.allowed) {
    return (
      <div className="mx-auto max-w-lg p-6">
        <div className="rounded-xl border border-line bg-white p-8 text-center shadow-sm">
          <Lock className="mx-auto mb-3 size-8 text-faint" />
          <h1 className="font-bold text-ink">Akses Dibatasi</h1>
          <p className="mt-1 text-muted text-xs">{decision.reason}</p>
          <Link
            href="/projects"
            className="mt-4 inline-block font-medium text-plum-600 text-xs hover:underline"
          >
            Kembali ke Semua Project
          </Link>
        </div>
      </div>
    );
  }

  const [pmCandidates, nextId] = await Promise.all([
    candidatesFor("PM"),
    previewNextProjectId(),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5 p-6">
      <nav className="flex items-center gap-1.5 text-muted text-xs">
        <Link href="/projects" className="hover:text-plum-600">
          Semua Project
        </Link>
        <ChevronRight className="size-3" />
        <span className="text-ink">Buat Project Baru</span>
      </nav>
      <div>
        <h1 className="font-bold text-ink text-xl">Buat Project Baru</h1>
        <p className="mt-0.5 text-muted text-xs">
          Isi data dasar. PM melengkapi sisanya.
        </p>
      </div>
      <CreateProjectForm pmCandidates={pmCandidates} nextId={nextId} />
    </div>
  );
}
