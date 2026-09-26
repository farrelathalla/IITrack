"use client";

import { createContext, type ReactNode, useContext } from "react";
import type { ProjectView } from "@/server/project/view";

const ProjectContext = createContext<ProjectView | null>(null);

export function ProjectProvider({
  view,
  children,
}: {
  view: ProjectView;
  children: ReactNode;
}) {
  return (
    <ProjectContext.Provider value={view}>{children}</ProjectContext.Provider>
  );
}

export function useProject(): ProjectView {
  const view = useContext(ProjectContext);
  if (!view) throw new Error("useProject dipakai di luar ProjectProvider.");
  return view;
}

export { useRunner } from "@/components/use-runner";
