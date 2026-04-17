import { useEffect, useMemo, useState } from "react";
import { usePreferences } from "../../context/PreferencesContext";
import type { LineupPlayer, PlayerFacingMetrics } from "../../types";
import { FeatureHelp } from "./FeatureHelp";

type Props = {
  players: LineupPlayer[];
  playerFacing: Record<string, PlayerFacingMetrics>;
};

function initials(label: string): string {
  const s = label.trim();
  if (!s) return "?";
  const p = /^P(\d)$/i.exec(s);
  if (p) return p[1]!;
  const compact = s.replace(/\s+/g, "");
  return compact.length <= 2 ? compact.toUpperCase() : compact.slice(0, 2).toUpperCase();
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function PlayerPerformanceSummary({ players, playerFacing }: Props) {
  const { t, displayNameForPlayer } = usePreferences();
  const ordered = useMemo(() => [...players].sort((a, b) => Number(a.id) - Number(b.id)), [players]);
  const [selectedId, setSelectedId] = useState<string>(ordered[0]?.id ?? "1");

  useEffect(() => {
    if (!ordered.find((p) => p.id === selectedId)) {
      setSelectedId(ordered[0]?.id ?? "1");
    }
  }, [ordered, selectedId]);

  const selected = playerFacing[selectedId];
  const valid = ordered.filter((p) => !!playerFacing[p.id]);
  if (!selected || !valid.length) return null;

  const maxDistance = Math.max(...valid.map((p) => playerFacing[p.id]!.distanceM), 1);
  const maxAvg = Math.max(...valid.map((p) => playerFacing[p.id]!.avgSpeedKmh), 1);
  const fastestByAvg = valid
    .map((p) => ({ id: p.id, v: playerFacing[p.id]!.avgSpeedKmh }))
    .sort((a, b) => b.v - a.v)[0]?.id;

  const bars = [
    { label: t("perf.distance"), value: `${selected.distanceM.toLocaleString()} m`, pct: clamp01(selected.distanceM / maxDistance) },
    { label: t("perf.avgSpeed"), value: `${selected.avgSpeedKmh} km/h`, pct: clamp01(selected.avgSpeedKmh / maxAvg) },
    { label: t("perf.steps"), value: `${selected.steps.toLocaleString()}`, pct: clamp01(selected.steps / Math.max(...valid.map((p) => playerFacing[p.id]!.steps), 1)) },
    {
      label: t("perf.calories"),
      value: `${selected.caloriesKcal.toLocaleString()} kcal`,
      pct: clamp01(selected.caloriesKcal / Math.max(...valid.map((p) => playerFacing[p.id]!.caloriesKcal), 1)),
    },
  ];
  const helpByLabel: Record<string, string> = {
    [t("perf.distance")]:
      "Total meters covered. Higher usually means higher workload. Typical 45-90 min match ballpark: ~1200-3000 m depending on level and style.",
    [t("perf.avgSpeed")]:
      "Average movement speed (distance / tracked time). Higher means faster overall pace. Typical recreational range often ~4-9 km/h.",
    [t("perf.steps")]:
      "Estimated number of steps from tracked distance. Higher usually means higher movement volume.",
    [t("perf.calories")]:
      "Estimated energy burn from tracked time + pace (heuristic). Use for relative comparison across your own matches.",
    [t("analysis.facing.rank")]:
      "Rank by total distance among the four players. #1 = most distance covered.",
    [t("analysis.facing.share")]:
      "Your share of total distance by all players. Around 25% is balanced workload in a 4-player match.",
  };

  return (
    <section className="rounded-card border border-cf-line/80 bg-white p-4 shadow-card-sm">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-cf-muted">{t("summary.performance")}</h2>

      <div className="mb-3 grid grid-cols-4 gap-2">
        {ordered.map((p) => {
          const name = displayNameForPlayer(p.id, p.label);
          const active = p.id === selectedId;
          const m = playerFacing[p.id];
          return (
            <button
              type="button"
              key={p.id}
              onClick={() => setSelectedId(p.id)}
              className={`rounded-2xl border px-2 py-2 text-center transition ${
                active ? "border-cf-navy bg-cf-navy/[0.03]" : "border-cf-line/70 bg-slate-50/70"
              }`}
            >
              <div className="mx-auto mb-1 flex h-11 w-11 items-center justify-center rounded-full bg-white text-xs font-bold text-cf-navy ring-1 ring-cf-line">
                {initials(name)}
              </div>
              <div className="truncate text-[11px] font-semibold text-cf-navy" title={name}>
                {name}
              </div>
              {p.id === fastestByAvg ? (
                <div className="mt-1 rounded-full bg-cf-lime/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cf-lime-dark">
                  Fastest
                </div>
              ) : null}
              {m ? (
                <div className="mt-1 text-[10px] text-cf-muted">
                  #{m.rankByDistance} · {Math.round(m.shareOfDistancePct)}%
                </div>
              ) : null}
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap gap-2 text-[11px]">
        <span className="rounded-full bg-cf-navy/10 px-2 py-1 font-semibold text-cf-navy">
          Fastest avg: P{fastestByAvg ?? "—"} <FeatureHelp text={helpByLabel[t("perf.avgSpeed")]!} />
        </span>
        <span className="rounded-full bg-cf-lime/20 px-2 py-1 font-semibold text-cf-lime-dark">
          {t("analysis.facing.rank")}: {selected.rankByDistance} <FeatureHelp text={helpByLabel[t("analysis.facing.rank")]!} />
        </span>
        <span className="rounded-full bg-cf-lime/20 px-2 py-1 font-semibold text-cf-lime-dark">
          {t("analysis.facing.share")}: {Math.round(selected.shareOfDistancePct)}%{" "}
          <FeatureHelp text={helpByLabel[t("analysis.facing.share")]!} />
        </span>
      </div>

      <ul className="space-y-2">
        {bars.map((b) => (
          <li key={b.label} className="rounded-xl border border-cf-line/70 bg-slate-50/60 p-2">
            <div className="mb-1 flex items-center justify-between text-[11px]">
              <span className="text-cf-muted">
                {b.label}
                {helpByLabel[b.label] ? <FeatureHelp text={helpByLabel[b.label]!} /> : null}
                {b.label === t("perf.avgSpeed") && selectedId === fastestByAvg ? (
                  <span className="ml-1 rounded-full bg-cf-lime/25 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide text-cf-lime-dark">
                    Fastest
                  </span>
                ) : null}
              </span>
              <span className="font-semibold tabular-nums text-cf-navy">{b.value}</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-cf-lime/20">
              <div className="h-full rounded-full bg-cf-lime-dark" style={{ width: `${Math.round(b.pct * 100)}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
