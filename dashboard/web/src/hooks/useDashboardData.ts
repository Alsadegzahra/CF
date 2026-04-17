import { useEffect, useState } from "react";
import type { MockMatch } from "../types";
import { getDemoMatch } from "../data/mockMatch";
import { ApiError, fetchCloudUrls, fetchJson } from "../api/client";
import { getApiBase } from "../api/config";
import { mapReportToView } from "../api/mapReportToView";

/** Bundled preview (`match_id=match_demo`). Replace with API branch below when wiring production. */
function isDemoMatchId(matchId: string): boolean {
  const m = matchId.trim().toLowerCase();
  return m === "match_demo" || m === "demo";
}

type MatchOut = {
  match_id: string;
  court_id: string;
};

export type DashboardState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ok"; data: MockMatch }
  | { status: "error"; message: string };

export function useDashboardData(matchId: string | null, courtFilter: string | null): DashboardState {
  const [state, setState] = useState<DashboardState>({ status: "idle" });

  useEffect(() => {
    if (!matchId?.trim()) {
      setState({ status: "idle" });
      return;
    }

    const mid = matchId.trim();
    const court = courtFilter?.trim() || null;

    if (isDemoMatchId(mid)) {
      setState({ status: "ok", data: getDemoMatch() });
      return;
    }

    let cancelled = false;

    async function run() {
      setState({ status: "loading" });
      try {
        const match = await fetchJson<MatchOut>(`/matches/${encodeURIComponent(mid)}`);
        if (cancelled) return;

        if (court && match.court_id !== court) {
          setState({
            status: "error",
            message: `This match belongs to court "${match.court_id}", not "${court}".`,
          });
          return;
        }

        const report = await fetchJson<Record<string, unknown>>(`/matches/${encodeURIComponent(mid)}/report`);
        if (cancelled) return;

        const cloud = await fetchCloudUrls(mid);
        const base = getApiBase();
        const heatmapUrl = cloud?.heatmap_url ?? `${base}/matches/${encodeURIComponent(mid)}/report/heatmap`;
        const videoUrl = cloud?.highlights_url ?? `${base}/matches/${encodeURIComponent(mid)}/highlights/video`;
        const reportPdfUrl = `${base}/matches/${encodeURIComponent(mid)}/report.pdf`;

        const data = mapReportToView(report, {
          matchId: match.match_id,
          courtId: match.court_id,
          heatmapUrl,
          highlightsVideoUrl: videoUrl,
          reportPdfUrl,
        });

        if (!cancelled) setState({ status: "ok", data });
      } catch (e) {
        if (cancelled) return;
        if (e instanceof ApiError) {
          if (e.status === 404) {
            setState({
              status: "error",
              message:
                "Match or report was not found. Check the match ID, run the pipeline so report.json exists, or confirm the API can reach your data / R2.",
            });
          } else {
            setState({ status: "error", message: `${e.message} (${e.status})` });
          }
        } else {
          setState({ status: "error", message: e instanceof Error ? e.message : String(e) });
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [matchId, courtFilter]);

  return state;
}
