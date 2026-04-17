import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePreferences } from "../../context/PreferencesContext";
import type { MockMatch } from "../../types";
import { chartColors } from "../charts/chartTheme";
import { Card } from "../ui/Card";
import { MetricTile } from "../ui/MetricTile";
import { SectionHeader } from "../ui/SectionHeader";

type PhysicalSectionProps = {
  data: MockMatch;
  playerId: string;
};

export function PhysicalSection({ data, playerId }: PhysicalSectionProps) {
  const { t, displayNameForPlayer } = usePreferences();
  const player = data.lineup.players.find((p) => p.id === playerId);
  const p = data.physicalByPlayer[playerId];
  if (!player || !p) {
    return (
      <section style={{ marginBottom: 28 }}>
        <p style={{ color: "var(--cf-text-muted)", fontSize: 14 }}>{t("summary.noPlayerData")}</p>
      </section>
    );
  }

  const name = displayNameForPlayer(player.id, player.label);
  const latFwd = [
    { name: t("analysis.lateral"), pct: p.lateralPct },
    { name: t("analysis.forward"), pct: p.forwardPct },
  ];

  return (
    <section style={{ marginBottom: 28 }}>
      <SectionHeader title={t("analysis.physical")} description={t("analysis.physicalDescSelected")} />

      <h3
        style={{
          margin: "0 0 12px",
          fontSize: 15,
          fontWeight: 700,
          color: "var(--cf-text)",
          letterSpacing: "-0.02em",
        }}
      >
        {name}
      </h3>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))",
          gap: 12,
          marginBottom: 16,
        }}
      >
        <MetricTile label={t("perf.distance")} value={`${p.distanceM.toLocaleString()} m`} />
        <MetricTile label={t("summary.avgSpeed")} value={`${p.avgSpeedKmh} km/h`} />
        <MetricTile label={t("summary.maxSpeed")} value={`${p.maxSpeedKmh} km/h`} />
        <MetricTile label={t("analysis.sprintCount")} value={p.sprintCount} hint={t("analysis.sprintHint")} />
        <MetricTile label={t("analysis.accelEvents")} value={p.accelerationEvents} />
        <MetricTile label={t("analysis.decelEvents")} value={p.decelerationEvents} />
        <MetricTile label={t("analysis.movementIntensity")} value={`${p.movementIntensity0to100} / 100`} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <Card padding="md">
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cf-text-secondary)", marginBottom: 10 }}>
            {t("analysis.fatigueTrend")}
          </div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={p.fatigueTrend} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
                <CartesianGrid stroke={chartColors.grid} vertical={false} />
                <XAxis
                  dataKey="t"
                  tick={{ fill: chartColors.axis, fontSize: 11 }}
                  tickLine={false}
                  axisLine={{ stroke: chartColors.grid }}
                  unit="m"
                />
                <YAxis tick={{ fill: chartColors.axis, fontSize: 11 }} tickLine={false} axisLine={false} width={36} />
                <Tooltip
                  contentStyle={{
                    background: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "var(--cf-text-muted)" }}
                />
                <Line type="monotone" dataKey="load" stroke={chartColors.accent} strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 11, color: "var(--cf-text-muted)" }}>{t("analysis.fatigueTrendHint")}</p>
        </Card>

        <Card padding="md">
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cf-text-secondary)", marginBottom: 10 }}>
            {t("analysis.lateralVsForward")}
          </div>
          <div style={{ width: "100%", height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={latFwd} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                <CartesianGrid stroke={chartColors.grid} horizontal={false} />
                <XAxis type="number" domain={[0, 100]} tick={{ fill: chartColors.axis, fontSize: 11 }} unit="%" />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: chartColors.axis, fontSize: 11 }}
                  width={56}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: chartColors.tooltipBg,
                    border: `1px solid ${chartColors.tooltipBorder}`,
                    borderRadius: 8,
                    fontSize: 12,
                    color: "var(--cf-text)",
                    boxShadow: "var(--cf-shadow-card)",
                  }}
                  labelStyle={{ color: "var(--cf-text-muted)", fontSize: 11 }}
                />
                <Bar dataKey="pct" fill={chartColors.accent} radius={[0, 6, 6, 0]} barSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </section>
  );
}
