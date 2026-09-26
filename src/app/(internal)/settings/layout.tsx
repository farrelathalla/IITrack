import { SettingsNav } from "@/components/settings/settings-nav";
import { visibleSections } from "@/lib/settings";
import { requireUser } from "@/server/auth/current";

export default async function SettingsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { viewer } = await requireUser();
  return (
    <div className="mx-auto max-w-[1280px] p-6">
      <div className="mb-5">
        <h1 className="font-bold text-ink text-xl">Pengaturan</h1>
        <p className="mt-0.5 text-muted text-xs">
          Profil dan pengaturan sesuai jabatanmu.
        </p>
      </div>
      <div className="grid grid-cols-[220px_1fr] items-start gap-5">
        <SettingsNav sections={visibleSections(viewer.role)} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
