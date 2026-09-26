import { Users } from "lucide-react";
import { initials } from "@/lib/auth/roles";
import { cn } from "@/lib/utils";

const SIZE = {
  xs: "size-5 text-[8px]",
  sm: "size-6 text-[9px]",
  md: "size-8 text-xs",
  lg: "size-14 text-lg",
} as const;

/**
 * Avatar inisial. `group` dipakai bila yang dimaksud adalah jabatan
 * (misalnya "COO / Vice COO"), bukan satu orang, supaya tidak tampil seperti
 * inisial nama.
 */
export function Avatar({
  name,
  size = "sm",
  group = false,
  className,
}: {
  name: string;
  size?: keyof typeof SIZE;
  group?: boolean;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full font-bold",
        group
          ? "border border-plum-200 bg-plum-50 text-plum-600"
          : "bg-plum-600 text-white",
        SIZE[size],
        className,
      )}
    >
      {group ? <Users className="size-[55%]" /> : initials(name)}
    </span>
  );
}
