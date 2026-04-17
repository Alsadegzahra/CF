import { useId } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { usePreferences } from "../../context/PreferencesContext";
import type { MockMatch } from "../../types";
import { chartColors } from "../charts/chartTheme";
import { Card } from "../ui/Card";
import { Pill } from "../ui/Pill";
import { SectionHeader } from "../ui/SectionHeader";

type TimelineSectionProps = {
  data: MockMatch;
  playerId: string;
};

export function TimelineSection({ data, playerId }: TimelineSectionProps) {
  const { t, displayNameForPlayer } = usePreferences();
  const gradId = useId().replace(/:/g, "");
  const player = data.lineup.players.find((p) => p.id === playerId);
  const tl = data.timelineByPlayer[playerId];

  if (!player || !tl) {
    return (
      <section style={{ marginBottom: 8 }}>
        <p style={{ color: "var(--cf-text-muted)", fontSize: 14 }}>{t("summary.noPlayerData")}</p>
      </section>
    );
  }

  const name = displayNameForPlayer(player.id, player.label);
  const chartData = tl.intensityByMinute;

  return (
    <section style={{ marginBottom: 8 }}>
      <SectionHeader title={t("analysis.timeline")} description={t("analysis.timelineDescSelected")} />

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

      <Card padding="md" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cf-text-secondary)", marginBottom: 10 }}>
          {t("analysis.movementIntensityTime")}
        </div>
        <div style={{ width: "100%", height: 260 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 12, right: 12, left: -12, bottom: 0 }}>
              <defs>
                <linearGradient id={`intensityFill-${gradId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={chartColors.accent} stopOpacity={0.35} />
                  <stop offset="100%" stopColor={chartColors.accent} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke={chartColors.grid} vertical={false} />
              <XAxis
                dataKey="minute"
                tick={{ fill: chartColors.axis, fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: chartColors.grid }}
                label={{ value: t("analysis.minuteAxis"), position: "insideBottom", offset: -4, fill: chartColors.axis, fontSize: 10 }}
              />
              <YAxis tick={{ fill: chartColors.axis, fontSize: 10 }} tickLine={false} axisLine={false} width={32} domain={[0, 100]} />
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
                formatter={(v: number) => [`${v}`, t("analysis.intensityLabel")]}
                labelFormatter={(m) => `${t("analysis.minute")} ${m}`}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke={chartColors.accent}
                strokeWidth={2}
                fill={`url(#intensityFill-${gradId})`}
              />
              {tl.peaks.map((pk, i) => {
                const row = chartData.find((d) => d.minute === pk.minute);
                const y = row?.value ?? 0;
                return (
                  <ReferenceDot
                    key={`peak-${i}`}
                    x={pk.minute}
                    y={y}
                    r={5}
                    fill={chartColors.peak}
                    stroke="var(--cf-elevated)"
                    strokeWidth={2}
                  />
                );
              })}
              {tl.highlightMarkers.map((hm, i) => {
                const row = chartData.find((d) => d.minute === hm.minute);
                const y = row?.value ?? 0;
                return (
                  <ReferenceDot
                    key={`hl-${i}`}
                    x={hm.minute}
                    y={y}
                    r={4}
                    fill={chartColors.highlight}
                    stroke="var(--cf-elevated)"
                    strokeWidth={2}
                  />
                );
              })}
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginTop: 12, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--cf-text-muted)", marginRight: 4 }}>{t("analysis.legend")}</span>
          <Pill variant="muted">● {t("analysis.intensityLabel")}</Pill>
          <Pill variant="muted" style={{ borderColor: chartColors.peak, color: chartColors.peak }}>
            ● {t("analysis.peaksLegend")}
          </Pill>
          <Pill variant="muted" style={{ borderColor: chartColors.highlight, color: chartColors.highlight }}>
            ● {t("analysis.highlightsLegend")}
          </Pill>
        </div>
      </Card>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        <Card padding="md">
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cf-text-secondary)", marginBottom: 12 }}>
            {t("analysis.peaksCard")}
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {tl.peaks.map((pk, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  background: "var(--cf-surface)",
                  border: "1px solid var(--cf-border)",
                  borderRadius: "var(--cf-radius-sm)",
                }}
              >
                <span style={{ color: "var(--cf-text)" }}>{pk.label}</span>
                <Pill variant="outline">
                  {pk.minute} {t("analysis.minShort")}
                </Pill>
              </li>
            ))}
          </ul>
        </Card>
        <Card padding="md">
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--cf-text-secondary)", marginBottom: 12 }}>
            {t("analysis.highlightMarkers")}
          </div>
          <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
            {tl.highlightMarkers.map((hm, i) => (
              <li
                key={i}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 12px",
                  background: "var(--cf-surface)",
                  border: "1px solid var(--cf-border)",
                  borderRadius: "var(--cf-radius-sm)",
                }}
              >
                <span style={{ color: "var(--cf-text)" }}>{hm.label}</span>
                <Pill variant="outline">
                  {hm.minute} {t("analysis.minShort")}
                </Pill>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </section>
  );
}
