/**
 * Shown while match report is loading — mirrors the summary column layout without fake text.
 */
export function DashboardLoadingSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-lg space-y-4 px-4 pb-8 pt-4 sm:max-w-2xl"
      role="status"
      aria-busy="true"
      aria-label="Loading"
    >
      <div className="h-36 rounded-card bg-slate-200/90 motion-safe:animate-pulse motion-reduce:animate-none" />
      <div className="grid grid-cols-3 gap-2">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-slate-200/90 motion-safe:animate-pulse motion-reduce:animate-none" />
        ))}
      </div>
      <div className="h-44 rounded-card bg-slate-200/90 motion-safe:animate-pulse motion-reduce:animate-none" />
      <div className="h-28 rounded-card bg-slate-200/90 motion-safe:animate-pulse motion-reduce:animate-none" />
    </div>
  );
}
