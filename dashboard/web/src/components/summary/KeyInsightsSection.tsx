import { usePreferences } from "../../context/PreferencesContext";

type KeyInsightsSectionProps = {
  insights: string[];
};

export function KeyInsightsSection({ insights }: KeyInsightsSectionProps) {
  const { t } = usePreferences();
  const items = insights.slice(0, 4);

  return (
    <section className="rounded-card border border-cf-line/80 bg-white p-4 shadow-card-sm">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-cf-muted">{t("summary.insights")}</h2>
      <ul className="space-y-3">
        {items.map((text, i) => (
          <li key={i} className="flex gap-3 text-sm leading-relaxed text-cf-navy/90">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-cf-lime/20 text-[10px] font-bold text-cf-lime-dark"
              aria-hidden
            >
              ✓
            </span>
            <span dir="auto">{text}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
