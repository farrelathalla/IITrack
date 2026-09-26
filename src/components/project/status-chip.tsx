import { Badge } from "@/components/ui/badge";
import {
  PROJECT_STATUS_LABELS,
  type ProjectStatus,
} from "@/lib/project/status";
import { PROJECT_TONE } from "./tones";

export function ProjectStatusChip({ status }: { status: ProjectStatus }) {
  return (
    <Badge tone={PROJECT_TONE[status]} dot>
      {PROJECT_STATUS_LABELS[status]}
    </Badge>
  );
}

export function ProjectIdChip({ code }: { code: string }) {
  return (
    <span className="rounded bg-surface-2 px-1.5 py-0.5 font-mono text-[10px] text-subtle">
      {code}
    </span>
  );
}
