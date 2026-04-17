import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { usePreferences } from "../../context/PreferencesContext";
import type { MockMatch } from "../../types";
import { chartColors, playerSeriesColors } from "../charts/chartTheme";
import { Card } from "../ui/Card";
import { MetricTile } from "../ui/MetricTile";
import { SectionHeader } from "../ui/SectionHeader";

type PositionalSectionProps = {
  data: MockMatch;
  playerId: string;
};

const ZONE_COLORS = ["#65a30d", "#84cc16", "#bef264"];

export function PositionalSection({ data, playerId }: PositionalSectionProps) {
  const { t, displayNameForPlayer } = usePreferences();
  const player = data.lineup.players.find((p) => p.id === playerId);
  const z = data.positionalByPlayer[playerId];
  const playerIndex = data.lineup.players
    .slice()
    .sort((a, b) => Number(a.id) - Number(b.id))
    .findIndex((p) => p.id === playerId);
  const accent = playerSeriesColors[Math.max(0, playerIndex) % playerSeriesColors.length];

  if (!player || !z) {
    return (
      <section style={{ marginBottom: 28 }}>
        <p style={{ color: "var(--cf-text-muted)", fontSize: 14 }}>{t("summary.noPlayerData")}</p>
      </section>
    );
  }

  const name = displayNameForPlayer(player.id, player.label);
  const pieData = [
    { name: t("analysis.zoneNet"), value: z.zoneNetPct },
    { name: t("analysis.zoneMid"), value: z.zoneMidPct },
    { name: t("analysis.zoneBack"), value: z.zoneBackPct },
  ];

  return (
    <section style={{ marginBottom: 28 }}>
      <SectionHeader title={t("analysis.positional")} description={t("analysis.positionalDescSelected")} />

      <h3
        style={{
          margin: "0 0 12px",
          fontSize: 15,
          fontWeight: 700,
          color: "var(--cf-text)",
          letterSpacing: "-0.02em",
          borderLeft: `4px solid ${accent}`,
          paddingLeft: 12,
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
        <MetricTile label={t("analysis.zoneNet")} value={`${z.zoneNetPct}%`} />
        <MetricTile label={t("analysis.zoneMid")} value={`${z.zoneMidPct}%`} />
        <MetricTile label={t("analysis.zoneBack")} value={`${z.zoneBackPct}%`} />
        <MetricTile label={t("analysis.spacingPlayer")} value={`${z.spacingM} m`} hint={t("analysis.teamSpacingHint")} />
        <MetricTile label={t("analysis.transitions")} value={z.transitions} hint={t("analysis.transitionsHint")} />
        <MetricTile label={t("analysis.coverageGaps")} value={z.coverageGaps} hint={t("analysis.coverageGapsHint")} />
        <MetricTile label={t("analysis.positionalDrift")} value={`${z.positionalDriftM} m`} hint={t("analysis.positionalDriftHint")} />
      </div>

      <Card padding="md">
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cf-text-secondary)", marginBottom: 8 }}>
          {t("analysis.zoneCoverageChart")}
        </div>
        <div style={{ width: "100%", height: 220, display: "flex", justifyContent: "center" }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={52}
                outerRadius={78}
                paddingAngle={3}
              >
                {pieData.map((_, i) => (
                  <Cell key={i} fill={ZONE_COLORS[i % ZONE_COLORS.length]} stroke="var(--cf-elevated)" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: chartColors.tooltipBg,
                  border: `1px solid ${chartColors.tooltipBorder}`,
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(v: number) => [`${v}%`, t("analysis.share")]}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </section>
  );
}
