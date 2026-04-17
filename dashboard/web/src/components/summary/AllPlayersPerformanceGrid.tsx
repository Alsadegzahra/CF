import { usePreferences } from "../../context/PreferencesContext";
import type { LineupPlayer, PlayerFacingMetrics, PlayerSpotlightStats } from "../../types";

type AllPlayersPerformanceGridProps = {
  players: LineupPlayer[];
  playerSpotlight: Record<string, PlayerSpotlightStats>;
  /** When set (demo + API), show rank / share / tracked time for UI parity. */
  playerFacing?: Record<string, PlayerFacingMetrics>;
  /** i18n key for section title (default: summary performance). */
  titleKey?: string;
  showPhaseNote?: boolean;
};

export function AllPlayersPerformanceGrid({
  players,
  playerSpotlight,
  playerFacing,
  titleKey = "summary.performance",
  showPhaseNote = true,
}: AllPlayersPerformanceGridProps) {
  const { t, displayNameForPlayer } = usePreferences();
  const ordered = [...players].sort((a, b) => Number(a.id) - Number(b.id));

  return (
    <section className="rounded-card border border-cf-line/80 bg-white p-4 shadow-card-sm">
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-cf-muted">{t(titleKey)}</h2>
      <div className="grid grid-cols-2 gap-3">
        {ordered.map((p) => {
          const stats = playerSpotlight[p.id];
          if (!stats) return null;
          const label = displayNameForPlayer(p.id, p.label);
          const face = playerFacing?.[p.id];
          const rows = [
            { label: t("perf.distance"), value: `${stats.distanceM.toLocaleString()} m` },
            { label: t("perf.avgSpeed"), value: `${stats.avgSpeedKmh} km/h` },
            { label: t("perf.maxSpeed"), value: `${stats.maxSpeedKmh} km/h` },
            { label: t("perf.netPresence"), value: `${Math.round(stats.netPresencePct)}%` },
            ...(face
              ? [
                  { label: t("analysis.facing.rank"), value: String(face.rankByDistance) },
                  { label: t("analysis.facing.share"), value: `${face.shareOfDistancePct}%` },
                  { label: t("analysis.facing.tracked"), value: `${Math.round(face.trackedTimeSec)} s` },
                ]
              : []),
          ];
          return (
            <div
              key={p.id}
              className="flex flex-col rounded-2xl border border-cf-line/70 bg-slate-50/80 p-3 shadow-sm"
            >
              <p className="mb-2 truncate border-b border-cf-line/60 pb-2 text-sm font-bold text-cf-navy" title={label}>
                {label}
              </p>
              <ul className="flex flex-1 flex-col gap-1.5">
                {rows.map((r) => (
                  <li key={r.label} className="flex items-baseline justify-between gap-2 text-[11px] leading-tight">
                    <span className="shrink-0 text-cf-muted">{r.label}</span>
                    <span className="min-w-0 text-right font-semibold tabular-nums text-cf-navy">{r.value}</span>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </div>
      {showPhaseNote ? (
        <p className="mt-3 text-[11px] leading-relaxed text-cf-muted/90">{t("summary.phase1")}</p>
      ) : null}
    </section>
  );
}
