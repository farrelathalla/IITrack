import { cn } from "@/lib/utils";

/** Bar progres tipis dengan angka n/total di kanan, seperti blok Stage. */
export function StageProgress({
  value,
  total,
  className,
}: {
  value: number;
  total: number;
  className?: string;
}) {
  const percent = total === 0 ? 0 : Math.round((value / total) * 100);
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-line">
        <div
          className="h-full rounded-full bg-plum-600 transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="w-8 text-right text-[10px] text-subtle tabular-nums">
        {value}/{total}
      </span>
    </div>
  );
}
