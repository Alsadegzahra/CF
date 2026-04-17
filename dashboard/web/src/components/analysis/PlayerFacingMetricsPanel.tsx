import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePreferences } from "../../context/PreferencesContext";
import type { PlayerFacingMetrics, PlayerTimelineDetail } from "../../types";
import { chartColors } from "../charts/chartTheme";
import { FeatureHelp } from "../summary/FeatureHelp";
import { Card } from "../ui/Card";
import { MetricTile } from "../ui/MetricTile";
import { SectionHeader } from "../ui/SectionHeader";

type Props = {
  playerId: string;
  facing: PlayerFacingMetrics | undefined;
  timeline?: PlayerTimelineDetail;
};

function fmt(v: number, suffix = ""): string {
  if (!Number.isFinite(v)) return "—";
  const s = Number.isInteger(v) ? String(v) : v.toFixed(1);
  return suffix ? `${s}${suffix}` : s;
}

/** Matches spatial._zone_index: 0–2 team half A, 3–5 team half B, × back/mid/net. */
const ZONE_CELL_KEYS = [
  "analysis.zoneCell0",
  "analysis.zoneCell1",
  "analysis.zoneCell2",
  "analysis.zoneCell3",
  "analysis.zoneCell4",
  "analysis.zoneCell5",
] as const;

export function PlayerFacingMetricsPanel({ playerId, facing, timeline }: Props) {
  const { t } = usePreferences();
  if (!facing) {
    return (
      <section className="rounded-card border border-dashed border-cf-line/80 bg-slate-50/60 p-4 text-[12px] text-cf-muted">
        {t("summary.noPlayerData")}
      </section>
    );
  }

  const helpByLabel: Record<string, string> = {
    [t("perf.distance")]:
      "Total meters covered. Higher usually means higher workload. Ballpark in a full amateur match can often land around 1200-3000 m.",
    [t("perf.steps")]:
      "Estimated step count from tracked distance. Higher usually means more movement volume.",
    [t("perf.calories")]:
      "Estimated calories burned from tracked duration and pace (heuristic, no body profile yet).",
    [t("analysis.facing.rank")]: "Rank by distance among the four tracked players. #1 means most distance covered.",
    [t("analysis.facing.share")]:
      "Your share of total distance by all players. Around 25% is balanced in a 4-player match.",
    [t("analysis.facing.tracked")]:
      "Seconds with valid tracking for this player. Higher tracked time usually means more reliable stats.",
    [t("perf.avgSpeed")]:
      "Average movement pace (distance / tracked time). Typical recreational range often ~4-9 km/h.",
    [t("perf.maxSpeed")]:
      "Fastest short burst. Useful for explosiveness, but compare trends over matches (single spikes can be noisy).",
    [t("analysis.sprintCount")]:
      "Count of high-intensity bursts. More sprints = more repeated explosive effort.",
    [t("analysis.lateral")]:
      "Percent of movement that is side-to-side. Higher indicates coverage/shuffling style.",
    [t("analysis.accelEvents")]: "Count of strong speed-ups between moments. More means more explosive changes of pace.",
    [t("analysis.decelEvents")]: "Count of strong slow-downs. High values can reflect many hard stops and direction changes.",
    [t("perf.netPresence")]:
      "Time near net. Not always better/worse by itself - interpret by role (aggressive vs defensive).",
    [t("analysis.facing.baseline")]:
      "Time spent deeper (away from net band). Higher values usually indicate deeper defensive positioning.",
  };
  const withHelp = (label: string) => (
    <span className="inline-flex items-center">
      {label}
      {helpByLabel[label] ? <FeatureHelp text={helpByLabel[label]!} /> : null}
    </span>
  );

  const metricTiles = [
    { label: t("perf.distance"), value: `${fmt(facing.distanceM)} m` },
    { label: t("perf.steps"), value: facing.steps.toLocaleString() },
    { label: t("perf.calories"), value: `${facing.caloriesKcal.toLocaleString()} kcal` },
    { label: t("analysis.facing.rank"), value: String(facing.rankByDistance) },
    { label: t("analysis.facing.share"), value: `${fmt(facing.shareOfDistancePct)}%` },
    { label: t("analysis.facing.tracked"), value: `${fmt(facing.trackedTimeSec)} s` },
    { label: t("perf.avgSpeed"), value: `${fmt(facing.avgSpeedKmh)} km/h` },
    { label: t("perf.maxSpeed"), value: `${fmt(facing.maxSpeedKmh)} km/h` },
    { label: t("analysis.sprintCount"), value: String(facing.sprintCount) },
    { label: t("analysis.lateral"), value: `${fmt(facing.lateralPct)}%` },
    { label: t("analysis.accelEvents"), value: String(facing.accelerationPeaks) },
    { label: t("analysis.decelEvents"), value: String(facing.decelerationCount) },
  ];
  const zoneBars = Array.from({ length: 6 }, (_, i) => {
    const k = String(i);
    return { cell: k, pct: Number(facing.zoneCoveragePct[k] ?? 0) };
  });
  const timelineData = timeline?.intensityByMinute ?? [];
  const peakDots = timeline?.peaks ?? [];

  return (
    <section>
      <SectionHeader title={t("analysis.facingTitle")} description={t("analysis.facingSubtitle")} />
      <p className="mb-3 text-xs font-semibold text-cf-navy">P{playerId}</p>
      <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
        {metricTiles.map((m) => (
          <MetricTile key={m.label} label={withHelp(m.label)} value={m.value} />
        ))}
        <MetricTile label={withHelp(t("perf.netPresence"))} value={`${fmt(facing.netPct)}%`} />
        <MetricTile label={withHelp(t("analysis.facing.baseline"))} value={`${fmt(facing.baselinePct)}%`} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card padding="md">
          <div className="mb-2 text-xs font-semibold text-cf-muted">{t("analysis.zoneCoverageChart")}</div>
          <div style={{ width: "100%", height: 210 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={zoneBars} margin={{ top: 6, right: 8, left: -18, bottom: 28 }}>
                <CartesianGrid stroke={chartColors.grid} vertical={false} />
                <XAxis
                  dataKey="cell"
                  tick={{ fill: chartColors.axis, fontSize: 10 }}
                  tickFormatter={(c) => {
                    const i = Number(c);
                    return i >= 0 && i <= 5 ? t(ZONE_CELL_KEYS[i]) : String(c);
                  }}
                  angle={-28}
                  textAnchor="end"
                  height={48}
                />
                <YAxis domain={[0, 100]} tick={{ fill: chartColors.axis, fontSize: 11 }} width={34} />
                <Tooltip
                  formatter={(v: number) => [`${v}%`, t("analysis.share")]}
                  labelFormatter={(c) => {
                    const i = Number(c);
                    return i >= 0 && i <= 5 ? t(ZONE_CELL_KEYS[i]) : String(c);
                  }}
                  contentStyle={{
                    background: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                />
                <Bar dataKey="pct" fill={chartColors.accent} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card padding="md">
          <div className="mb-2 text-xs font-semibold text-cf-muted">{t("analysis.movementIntensityTime")}</div>
          {timelineData.length ? (
            <div style={{ width: "100%", height: 210 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={timelineData} margin={{ top: 6, right: 8, left: -18, bottom: 0 }}>
                  <CartesianGrid stroke={chartColors.grid} vertical={false} />
                  <XAxis dataKey="minute" tick={{ fill: chartColors.axis, fontSize: 11 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: chartColors.axis, fontSize: 11 }} width={34} />
                  <Tooltip
                    formatter={(v: number) => [`${v}`, t("analysis.intensityLabel")]}
                    labelFormatter={(m) => `${t("analysis.minute")} ${m}`}
                    contentStyle={{
                      background: chartColors.tooltipBg,
                      border: `1px solid ${chartColors.tooltipBorder}`,
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <Area type="monotone" dataKey="value" stroke={chartColors.accent} fillOpacity={0.15} fill={chartColors.accent} />
                  {peakDots.map((pk, idx) => {
                    const row = timelineData.find((d) => d.minute === pk.minute);
                    return (
                      <ReferenceDot
                        key={`${pk.minute}-${idx}`}
                        x={pk.minute}
                        y={row?.value ?? 0}
                        r={4}
                        fill={chartColors.peak}
                        stroke="var(--cf-elevated)"
                        strokeWidth={1.5}
                      />
                    );
                  })}
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-cf-muted">{t("summary.noPlayerData")}</p>
          )}
        </Card>
      </div>

      <p className="mt-3 text-[11px] text-cf-muted/90">
        {t("analysis.facing.heatmap")}:{" "}
        {facing.heatmapUrl ? facing.heatmapUrl.slice(0, 64) + (facing.heatmapUrl.length > 64 ? "..." : "") : "—"}
      </p>
    </section>
  );
}
