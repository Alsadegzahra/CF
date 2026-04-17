import { useMemo } from "react";
import { usePreferences } from "../../context/PreferencesContext";
import type { MockMatch } from "../../types";
import { KeyInsightsSection } from "../summary/KeyInsightsSection";
import { MatchIntensitySection } from "../summary/MatchIntensitySection";
import { MatchOverviewGrid } from "../summary/MatchOverviewGrid";
import { PlayerPerformanceSummary } from "../summary/PlayerPerformanceSummary";
import { PlayerLineupCard } from "../summary/PlayerLineupCard";

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}m ${s}s`;
}

type SummaryViewProps = {
  data: MockMatch;
};

export function SummaryView({ data }: SummaryViewProps) {
  const { t } = usePreferences();
  const { summary, lineup, playerFacing } = data;

  const overviewMetrics = useMemo(
    () => [
      { label: t("summary.duration"), value: fmtDuration(summary.durationSec) },
      { label: t("summary.activeTime"), value: fmtDuration(summary.activeTimeSec) },
      { label: t("summary.breakTime"), value: fmtDuration(summary.breakTimeSec) },
    ],
    [summary.durationSec, summary.activeTimeSec, summary.breakTimeSec, t],
  );

  const hasAnyPlayerFacing = Object.keys(playerFacing).length > 0;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 pb-12 pt-2 sm:max-w-2xl sm:pb-16">
      <PlayerLineupCard players={lineup.players} matchId={data.matchId} />
      <MatchOverviewGrid metrics={overviewMetrics} />
      {hasAnyPlayerFacing ? (
        <PlayerPerformanceSummary players={lineup.players} playerFacing={playerFacing} />
      ) : (
        <p className="py-4 text-center text-sm text-cf-muted">{t("summary.noPlayerData")}</p>
      )}
      <KeyInsightsSection insights={summary.insights} />
      <MatchIntensitySection
        sparkline={summary.intensity.sparkline}
        score={summary.intensity.score0to100}
        label={summary.intensity.label}
        peakCaption={summary.intensityPeakCaption}
      />
    </div>
  );
}
