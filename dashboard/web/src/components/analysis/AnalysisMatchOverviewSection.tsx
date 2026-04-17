import { usePreferences } from "../../context/PreferencesContext";
import type { MockMatch } from "../../types";
import { Card } from "../ui/Card";
import { HeatmapPlaceholder } from "../ui/HeatmapPlaceholder";
import { MetricTile } from "../ui/MetricTile";
import { SectionHeader } from "../ui/SectionHeader";

type AnalysisMatchOverviewSectionProps = {
  data: MockMatch;
};

export function AnalysisMatchOverviewSection({ data }: AnalysisMatchOverviewSectionProps) {
  const { t } = usePreferences();
  const o = data.analysisMatchOverview;
  const s = data.summary;

  function fmtDuration(sec: number): string {
    const m = Math.floor(sec / 60);
    const s0 = Math.floor(sec % 60);
    return `${m}m ${s0}s`;
  }

  return (
    <section style={{ marginBottom: 20 }}>
      <SectionHeader title={t("analysis.matchOverview")} description={t("analysis.matchOverviewDesc")} />
      <div style={{ marginBottom: 10, display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
        {data.reportPdfUrl ? (
          <a
            href={data.reportPdfUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-full border border-cf-line bg-white px-3 py-1.5 text-xs font-semibold text-cf-navy shadow-sm hover:bg-slate-50"
          >
            {t("analysis.downloadReport")}
          </a>
        ) : (
          <>
            <button
              type="button"
              disabled
              className="cursor-not-allowed rounded-full border border-cf-line/70 bg-slate-100 px-3 py-1.5 text-xs font-semibold text-cf-muted"
              title={t("analysis.downloadReportUnavailable")}
            >
              {t("analysis.downloadReport")}
            </button>
            <span className="text-[11px] text-cf-muted">{t("analysis.downloadReportUnavailable")}</span>
          </>
        )}
      </div>

      <Card padding="md" style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cf-text-secondary)", marginBottom: 12 }}>
          {t("analysis.heatmap")}
        </div>
        <HeatmapPlaceholder imageUrl={o.heatmapUrl} />

        <div
          style={{
            marginTop: 18,
            paddingTop: 16,
            borderTop: "1px solid var(--cf-border, rgba(15, 23, 42, 0.08))",
          }}
        >
          <p style={{ margin: "0 0 12px", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", color: "var(--cf-text-muted)" }}>
            {t("analysis.teamPairMetrics")}
          </p>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
              gap: 12,
            }}
          >
            <MetricTile
              label={t("analysis.teamSpacingMatch")}
              value={`${o.teamSpacingM} m`}
              hint={t("analysis.teamSpacingMatchHint")}
            />
            <MetricTile
              label={t("analysis.coordinationConsistency")}
              value={`${o.coordinationConsistency0to100} / 100`}
              hint={t("analysis.coordinationConsistencyHint")}
            />
            <MetricTile
              label={t("analysis.avgTeammateDistance")}
              value={`${o.avgTeammateDistanceM} m`}
              hint={t("analysis.avgTeammateDistanceHint")}
            />
          </div>
        </div>
      </Card>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 12,
        }}
      >
        <MetricTile label={t("summary.duration")} value={fmtDuration(s.durationSec)} />
        <MetricTile label={t("summary.intensity")} value={`${s.intensity.label} · ${s.intensity.score0to100}`} />
        <MetricTile label={t("analysis.matchZoneNet")} value={`${o.zoneNetPct}%`} />
        <MetricTile label={t("analysis.matchZoneMid")} value={`${o.zoneMidPct}%`} />
        <MetricTile label={t("analysis.matchZoneBack")} value={`${o.zoneBackPct}%`} />
      </div>
    </section>
  );
}
