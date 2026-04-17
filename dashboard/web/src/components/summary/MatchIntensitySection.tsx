import { usePreferences } from "../../context/PreferencesContext";
import { SparklineMini } from "../ui/SparklineMini";

type MatchIntensitySectionProps = {
  sparkline: number[];
  score: number;
  label: string;
  peakCaption?: string;
};

export function MatchIntensitySection({ sparkline, score, label, peakCaption }: MatchIntensitySectionProps) {
  const { t } = usePreferences();

  return (
    <section className="rounded-card border border-cf-line/80 bg-white p-4 shadow-card-sm">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-cf-muted">{t("summary.intensity")}</h2>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-3xl font-bold tracking-tight text-cf-navy">{score}</p>
          <p className="text-xs font-semibold uppercase tracking-wide text-cf-lime-dark">{label}</p>
        </div>
        <div className="h-12 min-w-[140px] max-w-[200px] flex-1">
          <SparklineMini values={sparkline} height={48} />
        </div>
      </div>
      <div className="h-px w-full bg-gradient-to-r from-cf-lime/40 via-cf-lime/15 to-transparent" />
      {peakCaption ? (
        <p className="mt-3 text-[12px] leading-relaxed text-cf-muted" dir="auto">
          {peakCaption}
        </p>
      ) : (
        <p className="mt-3 text-[12px] leading-relaxed text-cf-muted">{t("summary.intensityBlurb")}</p>
      )}
    </section>
  );
}
