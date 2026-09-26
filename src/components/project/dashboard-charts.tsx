import type { ReactNode } from "react";
import type { DivisionBar, StatusSlice } from "@/lib/project/dashboard-charts";

const EMPTY = "Belum ada project tercatat";

export function DashboardCharts({
  bars,
  slices,
  empty,
}: {
  bars: DivisionBar[];
  slices: StatusSlice[];
  empty: boolean;
}) {
  const peak = Math.max(1, ...bars.map((bar) => bar.active + bar.completed));
  const total = slices.reduce((sum, slice) => sum + slice.value, 0);

  return (
    <div className="grid grid-cols-[1.4fr_1fr] gap-4">
      <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <h2 className="font-bold text-ink text-sm">Project per divisi</h2>
        <p className="mt-0.5 text-[11px] text-subtle">
          Dihitung dari divisi stage yang sedang berjalan.
        </p>
        {empty ? (
          <FadedChart label={EMPTY}>
            <div className="flex h-full items-end justify-around px-6 pb-6">
              {bars.map((bar) => (
                <span
                  key={bar.label}
                  className="w-10 rounded-t-md bg-[#d9d9e0]"
                  style={{ height: "45%" }}
                />
              ))}
            </div>
          </FadedChart>
        ) : (
          <div className="mt-4">
            <div className="flex h-44 items-end justify-around gap-4">
              {bars.map((bar) => (
                <div
                  key={bar.label}
                  className="flex h-full w-16 items-end justify-center gap-1"
                >
                  <Bar value={bar.active} peak={peak} className="bg-plum-600" />
                  <Bar
                    value={bar.completed}
                    peak={peak}
                    className="bg-success-text"
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex justify-around text-center text-[11px] text-muted">
              {bars.map((bar) => (
                <span key={bar.label} className="w-24">
                  {bar.label}
                </span>
              ))}
            </div>
            <Legend />
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-line bg-white p-5 shadow-sm">
        <h2 className="font-bold text-ink text-sm">Status project</h2>
        <p className="mt-0.5 text-[11px] text-subtle">
          Berjalan, selesai, dan belum dimulai.
        </p>
        {empty ? (
          <FadedChart label={EMPTY}>
            <div className="flex h-full items-center justify-center">
              <span className="size-28 rounded-full border-[14px] border-[#d9d9e0]" />
            </div>
          </FadedChart>
        ) : (
          <div className="mt-4 flex items-center gap-5">
            <Donut slices={slices} total={total} />
            <ul className="space-y-2 text-xs">
              {slices.map((slice) => (
                <li key={slice.key} className="flex items-center gap-2">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="text-muted">{slice.label}</span>
                  <span className="font-semibold text-ink">{slice.value}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}

function Bar({
  value,
  peak,
  className,
}: {
  value: number;
  peak: number;
  className: string;
}) {
  const height =
    value === 0 ? 0 : Math.max(8, Math.round((value / peak) * 100));
  return (
    <span className="flex h-full w-4 items-end">
      <span
        className={`block w-full rounded-t-md ${className}`}
        style={{ height: `${height}%` }}
        title={String(value)}
      />
    </span>
  );
}

function Legend() {
  return (
    <div className="mt-3 flex gap-4 text-[11px] text-muted">
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-plum-600" />
        Berjalan
      </span>
      <span className="inline-flex items-center gap-1.5">
        <span className="size-2 rounded-full bg-success-text" />
        Selesai
      </span>
    </div>
  );
}

function Donut({ slices, total }: { slices: StatusSlice[]; total: number }) {
  const radius = 42;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;
  return (
    <svg viewBox="0 0 120 120" className="size-36 shrink-0" aria-hidden="true">
      <circle
        cx="60"
        cy="60"
        r={radius}
        fill="none"
        stroke="#ececef"
        strokeWidth="14"
      />
      {slices.map((slice) => {
        const length = total === 0 ? 0 : (slice.value / total) * circumference;
        const circle = (
          <circle
            key={slice.key}
            cx="60"
            cy="60"
            r={radius}
            fill="none"
            stroke={slice.color}
            strokeWidth="14"
            strokeDasharray={`${length} ${circumference - length}`}
            strokeDashoffset={-offset}
            transform="rotate(-90 60 60)"
          />
        );
        offset += length;
        return circle;
      })}
      <text
        x="60"
        y="64"
        textAnchor="middle"
        className="fill-ink font-bold text-lg"
      >
        {total}
      </text>
    </svg>
  );
}

function FadedChart({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="relative mt-4 h-48 overflow-hidden rounded-xl bg-[#f3f3f5]">
      <div className="h-full opacity-40 grayscale">{children}</div>
      <p className="absolute inset-0 flex items-center justify-center px-6 text-center font-medium text-[#8d8d98] text-sm">
        {label}
      </p>
    </div>
  );
}
