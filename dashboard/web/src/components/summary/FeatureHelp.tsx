type FeatureHelpProps = {
  text: string;
};

export function FeatureHelp({ text }: FeatureHelpProps) {
  return (
    <span className="group relative ml-1 inline-flex align-middle">
      <button
        type="button"
        aria-label="Metric help"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-cf-line bg-white text-[10px] font-bold text-cf-muted hover:bg-slate-50"
      >
        ?
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-5 z-20 hidden w-52 -translate-x-1/2 rounded-lg border border-cf-line bg-white p-2 text-[10px] leading-relaxed text-cf-navy shadow-card-sm group-hover:block group-focus-within:block"
      >
        {text}
      </span>
    </span>
  );
}
