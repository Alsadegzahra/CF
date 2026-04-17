export type TabId = "summary" | "analysis" | "replay";

export type TeamId = "A" | "B";

export interface LineupPlayer {
  id: string;
  label: string;
  team: TeamId;
}

/**
 * Canonical player-facing metrics (tracks + homography; no ball).
 * Used for UI planning and demo parity with report.json / tiers.
 */
export interface PlayerFacingMetrics {
  distanceM: number;
  steps: number;
  caloriesKcal: number;
  rankByDistance: number;
  shareOfDistancePct: number;
  trackedTimeSec: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  sprintCount: number;
  lateralPct: number;
  accelerationPeaks: number;
  decelerationCount: number;
  netPct: number;
  baselinePct: number;
  /** Court cells 0–5 (%), keys "0".."5". */
  zoneCoveragePct: Record<string, number>;
  heatmapUrl: string | null;
}

/** Per-player movement stats for Summary "Your performance" (Phase 1 — no ball metrics). */
export interface PlayerSpotlightStats {
  distanceM: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  /** From court zones / net presence (movement-based). */
  netPresencePct: number;
}

/** Analysis tab — physical load per player. */
export interface PlayerPhysicalDetail {
  distanceM: number;
  avgSpeedKmh: number;
  maxSpeedKmh: number;
  sprintCount: number;
  accelerationEvents: number;
  decelerationEvents: number;
  fatigueTrend: { t: number; load: number }[];
  movementIntensity0to100: number;
  lateralPct: number;
  forwardPct: number;
}

/** Analysis tab — court / zones per player. */
export interface PlayerPositionalDetail {
  heatmapUrl: string | null;
  zoneNetPct: number;
  zoneMidPct: number;
  zoneBackPct: number;
  spacingM: number;
  transitions: number;
  coverageGaps: number;
  positionalDriftM: number;
}

/** Analysis tab — intensity curve + markers per player. */
export interface PlayerTimelineDetail {
  intensityByMinute: { minute: number; value: number }[];
  peaks: { minute: number; label: string }[];
  highlightMarkers: { minute: number; label: string }[];
}

/** Match-level Analysis header (heatmap + combined zones). */
export interface AnalysisMatchOverview {
  heatmapUrl: string | null;
  zoneNetPct: number;
  zoneMidPct: number;
  zoneBackPct: number;
  /** Team / pair level — not per player, not fully global (both sides). */
  teamSpacingM: number;
  /** 0–100 — steadiness of pair movement (Phase 1 heuristic). */
  coordinationConsistency0to100: number;
  /** Mean distance between partners within each pair (m). */
  avgTeammateDistanceM: number;
}

export interface MockMatch {
  matchId: string;
  courtId: string;
  /** Direct link to printable report PDF when available. */
  reportPdfUrl?: string | null;
  /** From report `court_logo_url` / `court.logo_url`, or overridden in browser per court. */
  courtLogoUrl?: string | null;
  /** P1–P4 with Team A vs B for lineup card */
  lineup: { players: LineupPlayer[] };
  /** Stats keyed by player id "1".."4" */
  playerSpotlight: Record<string, PlayerSpotlightStats>;
  /** Full player-facing metric set (same keys as product spec); always populated for demo + API-mapped matches. */
  playerFacing: Record<string, PlayerFacingMetrics>;
  summary: {
    durationSec: number;
    /** Time in play (movement tracked); remainder is breaks / idle. */
    activeTimeSec: number;
    breakTimeSec: number;
    totalDistanceM: number;
    avgSpeedKmh: number;
    maxSpeedKmh: number;
    insights: string[];
    /** Short caption for highest intensity window (movement-only). */
    intensityPeakCaption?: string;
    intensity: {
      label: string;
      score0to100: number;
      sparkline: number[];
    };
  };
  /** Analysis — match-wide heatmap and zone mix (all players). */
  analysisMatchOverview: AnalysisMatchOverview;
  /** Analysis — keyed by player id "1".."4". */
  physicalByPlayer: Record<string, PlayerPhysicalDetail>;
  positionalByPlayer: Record<string, PlayerPositionalDetail>;
  timelineByPlayer: Record<string, PlayerTimelineDetail>;
  replay: {
    videoPoster?: string;
    videoSrc: string | null;
    overlays: { id: string; label: string; defaultOn: boolean }[];
    highlights: { id: string; startSec: number; endSec: number; label: string }[];
  };
}
