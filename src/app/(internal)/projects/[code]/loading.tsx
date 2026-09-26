/** Skeleton Project Detail: header, stepper, panel stage. */
export default function Loading() {
  return (
    <div
      className="fade-in mx-auto max-w-[1280px] space-y-5 p-6"
      role="status"
      aria-label="Memuat project"
    >
      <div className="skeleton h-3 w-48" />
      <div className="skeleton h-52 rounded-xl" />
      <div className="skeleton h-40 rounded-xl" />
      <div className="skeleton h-72 rounded-xl" />
    </div>
  );
}
