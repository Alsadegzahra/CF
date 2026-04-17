import { useEffect, useMemo, useState } from "react";
import type { MockMatch } from "../../types";
import { AnalysisMatchOverviewSection } from "../analysis/AnalysisMatchOverviewSection";
import { AnalysisPlayerPicker } from "../analysis/AnalysisPlayerPicker";
import { PlayerFacingMetricsPanel } from "../analysis/PlayerFacingMetricsPanel";

type AnalysisViewProps = {
  data: MockMatch;
};

export function AnalysisView({ data }: AnalysisViewProps) {
  const firstId = useMemo(() => {
    const ids = data.lineup.players.map((p) => p.id).sort((a, b) => Number(a) - Number(b));
    return ids[0] ?? "1";
  }, [data.lineup.players]);

  const [selectedPlayerId, setSelectedPlayerId] = useState(firstId);

  useEffect(() => {
    const ids = new Set(data.lineup.players.map((p) => p.id));
    if (!ids.has(selectedPlayerId)) {
      setSelectedPlayerId(firstId);
    }
  }, [data.matchId, data.lineup.players, firstId, selectedPlayerId]);

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-5 pb-28 pt-2 sm:max-w-2xl">
      <AnalysisMatchOverviewSection data={data} />
      <AnalysisPlayerPicker
        players={data.lineup.players}
        selectedId={selectedPlayerId}
        onSelect={setSelectedPlayerId}
      />
      <PlayerFacingMetricsPanel
        playerId={selectedPlayerId}
        facing={data.playerFacing[selectedPlayerId]}
        timeline={data.timelineByPlayer[selectedPlayerId]}
      />
    </div>
  );
}
