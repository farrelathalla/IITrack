import { initials } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

export function Avatar({
  name,
  size = "sm",
  className,
}: {
  name: string;
  size?: "xs" | "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-plum-600 font-bold text-white",
        size === "xs" && "size-5 text-[8px]",
        size === "sm" && "size-6 text-[9px]",
        size === "md" && "size-8 text-xs",
        size === "lg" && "size-14 text-lg",
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
