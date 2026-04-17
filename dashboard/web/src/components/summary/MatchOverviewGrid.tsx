import { usePreferences } from "../../context/PreferencesContext";

type Metric = { label: string; value: string };

type MatchOverviewGridProps = {
  metrics: Metric[];
};

export function MatchOverviewGrid({ metrics }: MatchOverviewGridProps) {
  const { t } = usePreferences();

  return (
    <section>
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-cf-muted">{t("summary.overview")}</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="rounded-card border border-cf-line/80 bg-white p-4 shadow-card-sm"
          >
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-cf-muted">{m.label}</p>
            <p className="text-xl font-bold tracking-tight text-cf-navy">{m.value}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
