import type {
  AnalysisMatchOverview,
  LineupPlayer,
  MockMatch,
  PlayerFacingMetrics,
  PlayerPhysicalDetail,
  PlayerPositionalDetail,
  PlayerSpotlightStats,
  PlayerTimelineDetail,
} from "../types";

type ReportPlayer = {
  distance?: number;
  distance_m?: number;
  duration_s?: number;
  active_duration_s?: number;
  rank_by_distance?: number;
  share_of_distance_pct?: number;
  avg_speed?: number;
  max_speed?: number;
  sprint_count?: number;
  acceleration_peaks?: number;
  deceleration_count?: number;
  lateral_movement_pct?: number;
  zone_coverage_pct?: Record<string, number>;
  net_pct?: number;
  baseline_pct?: number;
};

type Tier2PlayerRow = {
  avg_speed_kmh?: number;
  max_speed_kmh?: number;
};

function estimateSteps(distanceM: number): number {
  // Average step length in court movement is roughly 0.78 m.
  return Math.max(0, Math.round(distanceM / 0.78));
}

function estimateCaloriesKcal(trackedTimeSec: number, avgSpeedKmh: number): number {
  const hours = Math.max(0, trackedTimeSec) / 3600;
  // Simple MET heuristic (no profile input yet): scales with movement pace.
  const met = Math.max(3, Math.min(8, 3 + Math.max(0, avgSpeedKmh - 4) * 0.6));
  const assumedWeightKg = 70;
  return Math.max(0, Math.round(met * assumedWeightKg * hours));
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Speeds in report are m/s → km/h for display; clamp absurd values (bad calibration). */
function mpsToKmh(mps: number): number {
  if (!Number.isFinite(mps) || mps <= 0) return 0;
  const kmh = mps * 3.6;
  return round1(Math.min(kmh, 85));
}

/**
 * spatial._zone_index: 0–2 = team half A (y<0.5) back/mid/net; 3–5 = half B (y>0.5) back/mid/net.
 * Full court width per half (x ignored).
 */
function zoneDepthSum(z: Record<string, number> | undefined, depth: "back" | "mid" | "net"): number {
  if (!z || typeof z !== "object") return 0;
  if (depth === "back") return (z["0"] ?? 0) + (z["3"] ?? 0);
  if (depth === "mid") return (z["1"] ?? 0) + (z["4"] ?? 0);
  return (z["2"] ?? 0) + (z["5"] ?? 0);
}

function aggregateZones(players: Record<string, ReportPlayer>): { net: number; mid: number; back: number } {
  const ids = Object.keys(players);
  if (!ids.length) return { net: 0, mid: 0, back: 0 };
  let net = 0;
  let mid = 0;
  let back = 0;
  for (const id of ids) {
    const z = players[id]?.zone_coverage_pct;
    net += zoneDepthSum(z, "net");
    mid += zoneDepthSum(z, "mid");
    back += zoneDepthSum(z, "back");
  }
  const n = ids.length;
  return {
    net: round1(net / n),
    mid: round1(mid / n),
    back: round1(back / n),
  };
}

function buildIntensityByMinute(
  durationSec: number,
  highlights: { start?: number; end?: number }[],
): { minute: number; value: number }[] {
  const totalMin = Math.max(1, Math.ceil(durationSec / 60));
  const out: { minute: number; value: number }[] = [];
  for (let m = 0; m < totalMin; m++) {
    const t0 = m * 60;
    const t1 = (m + 1) * 60;
    let v = 32;
    for (const h of highlights) {
      const a = h.start ?? 0;
      const b = h.end ?? a;
      const overlap = Math.max(0, Math.min(t1, b) - Math.max(t0, a));
      if (overlap > 0) v += (overlap / 60) * 40;
    }
    v = Math.min(96, Math.round(v + Math.sin(m * 0.4) * 4));
    out.push({ minute: m, value: v });
  }
  return out;
}

function fatigueFromDuration(totalS: number): { t: number; load: number }[] {
  const segments = 12;
  const step = Math.max(5, totalS / segments);
  return Array.from({ length: segments }, (_, i) => ({
    t: Math.round(i * step),
    load: Math.min(98, Math.round(36 + (i * 55) / segments + Math.sin(i) * 5)),
  }));
}

function intensityScore(avgKmh: number, durationSec: number, totalDistM: number): { score: number; label: string } {
  const durMin = durationSec / 60;
  const density = durMin > 0 ? totalDistM / durMin : 0;
  let score = 38 + Math.min(35, avgKmh * 2.2) + Math.min(25, density / 3);
  score = Math.max(15, Math.min(100, Math.round(score)));
  const label = score < 42 ? "Low" : score < 68 ? "Moderate" : "High";
  return { score, label };
}

function sparklineFromIntensity(series: { value: number }[], target = 14): number[] {
  if (!series.length) return Array(target).fill(40);
  if (series.length <= target) {
    const pad = [...series.map((s) => s.value)];
    while (pad.length < target) pad.push(pad[pad.length - 1] ?? 40);
    return pad.slice(0, target);
  }
  const step = (series.length - 1) / (target - 1);
  return Array.from({ length: target }, (_, i) => {
    const idx = Math.round(i * step);
    return series[Math.min(idx, series.length - 1)]!.value;
  });
}

function buildLineup(playerIds: string[]): LineupPlayer[] {
  const sorted = [...new Set(playerIds)].sort((a, b) => Number(a) - Number(b));
  const base = sorted.length ? sorted : ["1", "2", "3", "4"];
  const padded = [...base];
  while (padded.length < 4) padded.push(String(padded.length + 1));
  return padded.slice(0, 4).map((id, i) => ({
    id,
    label: `P${id}`,
    team: i < 2 ? "A" : "B",
  }));
}

function buildPlayerSpotlight(
  players: Record<string, ReportPlayer>,
  lineupIds: string[],
  tier2ByPlayer?: Record<string, Tier2PlayerRow>,
): Record<string, PlayerSpotlightStats> {
  const out: Record<string, PlayerSpotlightStats> = {};
  for (const id of lineupIds) {
    const p = players[id];
    if (!p) {
      out[id] = { distanceM: 0, avgSpeedKmh: 0, maxSpeedKmh: 0, netPresencePct: 0 };
      continue;
    }
    const t2 = tier2ByPlayer?.[id];
    const dist =
      typeof p.distance_m === "number" && Number.isFinite(p.distance_m)
        ? p.distance_m
        : (p.distance ?? 0);
    const avgKmh =
      typeof t2?.avg_speed_kmh === "number" && Number.isFinite(t2.avg_speed_kmh)
        ? round1(t2.avg_speed_kmh)
        : mpsToKmh(p.avg_speed ?? 0);
    const maxKmh =
      typeof t2?.max_speed_kmh === "number" && Number.isFinite(t2.max_speed_kmh)
        ? round1(t2.max_speed_kmh)
        : mpsToKmh(p.max_speed ?? 0);
    out[id] = {
      distanceM: round1(dist),
      avgSpeedKmh: avgKmh,
      maxSpeedKmh: maxKmh,
      netPresencePct: round1(typeof p.net_pct === "number" ? p.net_pct : 0),
    };
  }
  return out;
}

function buildInsightBullets(
  zones: { net: number; mid: number; back: number },
  lateralPct: number,
  durationSec: number,
  intensityByMinute: { minute: number; value: number }[],
  fallbackLine: string,
): string[] {
  const lines: string[] = [];
  if (zones.net >= 28) {
    lines.push("High net dominance — more time in the front zone vs mid/back (movement-based).");
  }
  if (lateralPct >= 50) {
    lines.push("Strong lateral movement — side-to-side workload is elevated.");
  }
  if (zones.back <= 30) {
    lines.push("Low backcourt coverage — deeper positioning may help in transitions.");
  }
  if (durationSec >= 900 && intensityByMinute.length >= 12) {
    const n = intensityByMinute.length;
    const t = Math.floor(n / 3);
    const early = intensityByMinute.slice(0, t);
    const late = intensityByMinute.slice(Math.floor((n * 2) / 3));
    const avgEarly = early.reduce((s, x) => s + x.value, 0) / (early.length || 1);
    const avgLate = late.reduce((s, x) => s + x.value, 0) / (late.length || 1);
    if (avgLate < avgEarly * 0.88) {
      lines.push("Intensity dropped in the final stretch vs the opening phase.");
    }
  }
  if (lines.length < 3) {
    lines.push("Movement load aligns with tracked court time (Phase 1 — no ball or rally signal).");
  }
  const merged = [fallbackLine, ...lines];
  const seen = new Set<string>();
  const unique = merged.filter((x) => {
    const k = x.slice(0, 48);
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return unique.slice(0, 4);
}

function intensityPeakCaptionFromSeries(intensityByMinute: { minute: number; value: number }[]): string | undefined {
  if (!intensityByMinute.length) return undefined;
  let best = intensityByMinute[0]!;
  for (const p of intensityByMinute) {
    if (p.value > best.value) best = p;
  }
  return `Highest movement intensity around minute ${best.minute} — peak displacement and speed combined.`;
}

function zonesForPlayer(
  p: ReportPlayer | undefined,
  fallback: { net: number; mid: number; back: number },
  id: string,
): { net: number; mid: number; back: number } {
  const z = p?.zone_coverage_pct;
  if (z && typeof z === "object") {
    const rawNet = zoneDepthSum(z, "net");
    const rawMid = zoneDepthSum(z, "mid");
    const rawBack = zoneDepthSum(z, "back");
    const sum = rawNet + rawMid + rawBack;
    if (sum > 0) {
      return {
        net: round1((rawNet / sum) * 100),
        mid: round1((rawMid / sum) * 100),
        back: round1((rawBack / sum) * 100),
      };
    }
  }
  const n = Number(id) || 1;
  const net = round1(Math.max(5, Math.min(42, fallback.net + (n - 2.5) * 2.5)));
  const mid = round1(Math.max(22, Math.min(56, fallback.mid + (n % 2) * 2 - 1)));
  const back = round1(Math.max(8, 100 - net - mid));
  return { net, mid, back };
}

function varyIntensitySeries(
  base: { minute: number; value: number }[],
  playerId: string,
): { minute: number; value: number }[] {
  const seed = Number(playerId) || 1;
  return base.map((pt, i) => ({
    minute: pt.minute,
    value: Math.max(
      15,
      Math.min(98, Math.round(pt.value + Math.sin((i + seed) * 0.35) * 9 + (seed - 2.5) * 3)),
    ),
  }));
}

function buildPhysicalByPlayer(
  players: Record<string, ReportPlayer>,
  lineupIds: string[],
  playerSpotlight: Record<string, PlayerSpotlightStats>,
  totalDurationS: number,
  score0to100: number,
  lateralPct: number,
): Record<string, PlayerPhysicalDetail> {
  const out: Record<string, PlayerPhysicalDetail> = {};
  for (const id of lineupIds) {
    const p = players[id];
    const spot = playerSpotlight[id]!;
    const n = Number(id) || 1;
    const lat =
      typeof p?.lateral_movement_pct === "number"
        ? round1(Math.min(90, Math.max(10, p.lateral_movement_pct)))
        : round1(Math.min(90, Math.max(10, lateralPct + (n - 2.5) * 4)));
    out[id] = {
      distanceM: spot.distanceM,
      avgSpeedKmh: spot.avgSpeedKmh,
      maxSpeedKmh: spot.maxSpeedKmh,
      sprintCount:
        typeof p?.sprint_count === "number" ? p.sprint_count : Math.max(0, Math.round(5 + n * 2.5)),
      accelerationEvents:
        typeof p?.acceleration_peaks === "number" ? p.acceleration_peaks : Math.max(0, Math.round(22 + n * 16)),
      decelerationEvents:
        typeof p?.deceleration_count === "number" ? p.deceleration_count : Math.max(0, Math.round(21 + n * 15)),
      fatigueTrend: fatigueFromDuration(totalDurationS || 3600),
      movementIntensity0to100: Math.max(15, Math.min(100, score0to100 + Math.round((n - 2.5) * 4))),
      lateralPct: lat,
      forwardPct: round1(Math.max(10, 100 - lat)),
    };
  }
  return out;
}

function buildPositionalByPlayer(
  players: Record<string, ReportPlayer>,
  lineupIds: string[],
  zones: { net: number; mid: number; back: number },
  heatmapUrl: string | null,
  teamSpacingM: number,
  transitionsBase: number,
): Record<string, PlayerPositionalDetail> {
  const out: Record<string, PlayerPositionalDetail> = {};
  for (const id of lineupIds) {
    const p = players[id];
    const z = zonesForPlayer(p, zones, id);
    const n = Number(id) || 1;
    out[id] = {
      heatmapUrl,
      zoneNetPct: z.net,
      zoneMidPct: z.mid,
      zoneBackPct: z.back,
      spacingM: round1(teamSpacingM + (n - 2.5) * 0.45),
      transitions: Math.max(8, Math.round(transitionsBase / 4 + n * 14)),
      coverageGaps: Math.max(0, Math.min(8, 5 - (n % 3))),
      positionalDriftM: round1(0.7 + n * 0.18),
    };
  }
  return out;
}

function assignRankShareFromDistances(out: Record<string, PlayerFacingMetrics>, lineupIds: string[]) {
  const ids = lineupIds.filter((id) => out[id]);
  if (!ids.length) return;
  const total = ids.reduce((s, id) => s + out[id].distanceM, 0);
  const sorted = [...ids].sort((a, b) => out[b].distanceM - out[a].distanceM);
  sorted.forEach((id, idx) => {
    out[id].rankByDistance = idx + 1;
    out[id].shareOfDistancePct = total > 0 ? round1((100 * out[id].distanceM) / total) : 0;
  });
}

function buildPlayerFacingFromReport(
  players: Record<string, ReportPlayer>,
  lineupIds: string[],
  tier2ByPlayer: Record<string, Tier2PlayerRow> | undefined,
  combinedHeatmapUrl: string | null,
): Record<string, PlayerFacingMetrics> {
  const emptyZones = (): Record<string, number> => ({
    "0": 0,
    "1": 0,
    "2": 0,
    "3": 0,
    "4": 0,
    "5": 0,
  });
  const out: Record<string, PlayerFacingMetrics> = {};
  for (const id of lineupIds) {
    const p = players[id];
    if (!p) {
      out[id] = {
        distanceM: 0,
        steps: 0,
        caloriesKcal: 0,
        rankByDistance: 0,
        shareOfDistancePct: 0,
        trackedTimeSec: 0,
        avgSpeedKmh: 0,
        maxSpeedKmh: 0,
        sprintCount: 0,
        lateralPct: 0,
        accelerationPeaks: 0,
        decelerationCount: 0,
        netPct: 0,
        baselinePct: 0,
        zoneCoveragePct: emptyZones(),
        heatmapUrl: null,
      };
      continue;
    }
    const t2 = tier2ByPlayer?.[id];
    const dm =
      typeof p.distance_m === "number" && Number.isFinite(p.distance_m) ? round1(p.distance_m) : round1(p.distance ?? 0);
    const avgKmh =
      typeof t2?.avg_speed_kmh === "number" && Number.isFinite(t2.avg_speed_kmh)
        ? round1(t2.avg_speed_kmh)
        : mpsToKmh(p.avg_speed ?? 0);
    const maxKmh =
      typeof t2?.max_speed_kmh === "number" && Number.isFinite(t2.max_speed_kmh)
        ? round1(t2.max_speed_kmh)
        : mpsToKmh(p.max_speed ?? 0);
    const zraw = p.zone_coverage_pct && typeof p.zone_coverage_pct === "object" ? { ...p.zone_coverage_pct } : {};
    const zc: Record<string, number> = emptyZones();
    for (let k = 0; k < 6; k++) {
      const key = String(k);
      const v = zraw[key];
      zc[key] = typeof v === "number" && Number.isFinite(v) ? v : 0;
    }
    const tracked =
      typeof p.active_duration_s === "number" && Number.isFinite(p.active_duration_s)
        ? round1(p.active_duration_s)
        : round1(p.duration_s ?? 0);
    out[id] = {
      distanceM: dm,
      steps: estimateSteps(dm),
      caloriesKcal: estimateCaloriesKcal(tracked, avgKmh),
      rankByDistance: 0,
      shareOfDistancePct: 0,
      trackedTimeSec: tracked,
      avgSpeedKmh: avgKmh,
      maxSpeedKmh: maxKmh,
      sprintCount: typeof p.sprint_count === "number" ? p.sprint_count : 0,
      lateralPct: typeof p.lateral_movement_pct === "number" ? round1(p.lateral_movement_pct) : 0,
      accelerationPeaks: typeof p.acceleration_peaks === "number" ? p.acceleration_peaks : 0,
      decelerationCount: typeof p.deceleration_count === "number" ? p.deceleration_count : 0,
      netPct: round1(typeof p.net_pct === "number" ? p.net_pct : 0),
      baselinePct: round1(typeof p.baseline_pct === "number" ? p.baseline_pct : 0),
      zoneCoveragePct: zc,
      // Keep a single movement heatmap for all players in this release.
      heatmapUrl: combinedHeatmapUrl,
    };
  }
  assignRankShareFromDistances(out, lineupIds);
  return out;
}

function buildTimelineByPlayer(
  lineupIds: string[],
  intensityByMinute: { minute: number; value: number }[],
  peaks: { minute: number; label: string }[],
  highlightMarkers: { minute: number; label: string }[],
): Record<string, PlayerTimelineDetail> {
  const out: Record<string, PlayerTimelineDetail> = {};
  for (const id of lineupIds) {
    out[id] = {
      intensityByMinute: varyIntensitySeries(intensityByMinute, id),
      peaks: peaks.map((pk) => ({ ...pk, label: `${pk.label} · P${id}` })),
      highlightMarkers: highlightMarkers.map((hm) => ({ ...hm, label: `${hm.label} · P${id}` })),
    };
  }
  return out;
}

export function mapReportToView(
  report: Record<string, unknown>,
  opts: {
    matchId: string;
    courtId: string;
    heatmapUrl: string | null;
    highlightsVideoUrl: string | null;
    reportPdfUrl?: string | null;
  },
): MockMatch {
  const summary = (report.summary as Record<string, number | string | undefined>) || {};
  const players = (report.players as Record<string, ReportPlayer>) || {};
  const video = (report.video as { duration_seconds?: number }) || {};
  const analytics = (report.analytics as Record<string, unknown>) || {};

  const durationSec =
    (typeof summary.match_duration_seconds === "number" ? summary.match_duration_seconds : undefined) ??
    (typeof video.duration_seconds === "number" ? video.duration_seconds : 0) ??
    0;

  const activeFromReport =
    typeof summary.active_time_seconds === "number"
      ? summary.active_time_seconds
      : typeof summary.active_time_sec === "number"
        ? summary.active_time_sec
        : undefined;
  const breakFromReport =
    typeof summary.break_time_seconds === "number"
      ? summary.break_time_seconds
      : typeof summary.break_time_sec === "number"
        ? summary.break_time_sec
        : undefined;

  let activeTimeSec =
    activeFromReport !== undefined && Number.isFinite(activeFromReport)
      ? Math.max(0, Math.round(activeFromReport))
      : Math.round(durationSec * 0.82);
  if (activeTimeSec > durationSec) activeTimeSec = durationSec;
  let breakTimeSec =
    breakFromReport !== undefined && Number.isFinite(breakFromReport)
      ? Math.max(0, Math.round(breakFromReport))
      : Math.max(0, durationSec - activeTimeSec);
  if (activeTimeSec + breakTimeSec !== durationSec && durationSec > 0) {
    breakTimeSec = Math.max(0, durationSec - activeTimeSec);
  }

  const totalDistance = typeof summary.total_distance === "number" ? summary.total_distance : 0;
  const totalDurationS = typeof summary.total_duration_s === "number" ? summary.total_duration_s : durationSec || 0;

  const avgKmh =
    totalDurationS > 0 && totalDistance > 0 ? round1((totalDistance / totalDurationS) * 3.6) : 0;

  let maxMps = 0;
  for (const p of Object.values(players)) {
    const m = p?.max_speed;
    if (typeof m === "number" && m > maxMps) maxMps = m;
  }
  const maxKmh = mpsToKmh(maxMps);

  let sprintCount = 0;
  let accel = 0;
  let decel = 0;
  let lateralSum = 0;
  let lateralN = 0;
  for (const p of Object.values(players)) {
    if (p == null) continue;
    sprintCount += p.sprint_count ?? 0;
    accel += p.acceleration_peaks ?? 0;
    decel += p.deceleration_count ?? 0;
    if (typeof p.lateral_movement_pct === "number") {
      lateralSum += p.lateral_movement_pct;
      lateralN += 1;
    }
  }
  const lateralPct = lateralN > 0 ? round1(lateralSum / lateralN) : 0;

  const zones = aggregateZones(players);

  let teamSpacingM = 0;
  const ts = analytics.team_spacing_m as Record<string, number> | undefined;
  if (ts && typeof ts === "object") {
    const a = ts.team_1_avg_m;
    const b = ts.team_2_avg_m;
    const nums = [a, b].filter((x) => typeof x === "number") as number[];
    if (nums.length) teamSpacingM = round1(nums.reduce((s, x) => s + x, 0) / nums.length);
  }

  const hlRaw = report.highlights as { start?: number; end?: number; reason?: string }[] | undefined;
  const highlights = Array.isArray(hlRaw) ? hlRaw : [];

  const intensityByMinute = buildIntensityByMinute(durationSec, highlights);
  const { score: score0to100, label: intensityLabel } = intensityScore(avgKmh, durationSec, totalDistance);

  const insightLine =
    typeof summary.insight === "string" && summary.insight.trim()
      ? summary.insight.trim()
      : `${Object.keys(players).length} players · ${round1(totalDistance)} m · ${round1(totalDurationS)} s`;

  const tiers = report.analytics_tiers as { tier_2?: { players?: Record<string, Tier2PlayerRow> } } | undefined;
  const tier2Players = tiers?.tier_2?.players;

  const lineupPlayers = buildLineup(Object.keys(players).length ? Object.keys(players) : ["1", "2", "3", "4"]);
  const playerSpotlight = buildPlayerSpotlight(
    players,
    lineupPlayers.map((p) => p.id),
    tier2Players,
  );

  const peaks = highlights.slice(0, 5).map((h, i) => ({
    minute: Math.floor((h.start ?? 0) / 60),
    label: h.reason ? String(h.reason).replace(/_/g, " ") : `Peak ${i + 1}`,
  }));

  const highlightMarkers = highlights.slice(0, 8).map((h, i) => ({
    minute: Math.floor((h.start ?? 0) / 60),
    label: h.reason ? String(h.reason).replace(/_/g, " ") : `Highlight ${i + 1}`,
  }));

  const exported = report.exported_highlights as { file?: string; start?: number; end?: number; reason?: string }[] | undefined;
  const hlSource =
    Array.isArray(exported) && exported.length > 0
      ? exported
      : highlights.map((h, i) => ({ ...h, file: `segment_${i}` }));

  const replayHighlights = hlSource.map((h, i) => ({
    id: `h${i}`,
    startSec: h.start ?? 0,
    endSec: h.end ?? (h.start ?? 0) + 10,
    label: (h.reason ? String(h.reason) : "Highlight").replace(/_/g, " "),
  }));

  const movementIntensity0to100 = score0to100;

  const lineupIdsForAnalysis = lineupPlayers.map((p) => p.id);
  const transitionsBase = Math.max(highlights.length * 6, Math.round((totalDurationS || 60) / 45));

  const physicalByPlayer = buildPhysicalByPlayer(
    players,
    lineupIdsForAnalysis,
    playerSpotlight,
    totalDurationS || durationSec || 60,
    movementIntensity0to100,
    lateralPct,
  );
  const positionalByPlayer = buildPositionalByPlayer(
    players,
    lineupIdsForAnalysis,
    zones,
    opts.heatmapUrl,
    teamSpacingM || round1(totalDistance / Math.max(4, Object.keys(players).length || 4)),
    transitionsBase,
  );
  const timelinePeaksForPlayer = peaks.length
    ? peaks
    : [
        { minute: 0, label: "Start" },
        { minute: Math.floor(durationSec / 120), label: "Mid" },
      ];
  const timelineMarkersForPlayer = highlightMarkers.length ? highlightMarkers : timelinePeaksForPlayer;
  const timelineByPlayer = buildTimelineByPlayer(
    lineupIdsForAnalysis,
    intensityByMinute,
    timelinePeaksForPlayer,
    timelineMarkersForPlayer,
  );

  const playerFacing = buildPlayerFacingFromReport(
    players,
    lineupIdsForAnalysis,
    tier2Players,
    opts.heatmapUrl,
  );

  const insightBullets = buildInsightBullets(
    zones,
    lateralPct,
    durationSec,
    intensityByMinute,
    insightLine,
  );
  const peakCaption = intensityPeakCaptionFromSeries(intensityByMinute);

  const spacingBase = teamSpacingM || round1(totalDistance / Math.max(4, Object.keys(players).length || 4));
  const coordinationConsistency0to100 = Math.min(
    100,
    Math.max(30, Math.round(score0to100 * 0.72 + 18 + Math.min(12, lateralPct * 0.08))),
  );
  const avgTeammateDistanceM = round1(spacingBase * 0.9);

  const analysisMatchOverview: AnalysisMatchOverview = {
    heatmapUrl: opts.heatmapUrl,
    zoneNetPct: zones.net,
    zoneMidPct: zones.mid,
    zoneBackPct: zones.back,
    teamSpacingM: spacingBase,
    coordinationConsistency0to100,
    avgTeammateDistanceM,
  };

  const courtLogoFromReport = ((): string | null => {
    const top = report.court_logo_url;
    if (typeof top === "string" && top.trim()) return top.trim();
    const court = report.court as Record<string, unknown> | undefined;
    if (court) {
      const logo = court.logo_url;
      if (typeof logo === "string" && logo.trim()) return logo.trim();
    }
    return null;
  })();

  return {
    matchId: opts.matchId,
    courtId: opts.courtId,
    reportPdfUrl: opts.reportPdfUrl ?? null,
    courtLogoUrl: courtLogoFromReport,
    analysisMatchOverview,
    lineup: { players: lineupPlayers },
    playerSpotlight,
    playerFacing,
    summary: {
      durationSec,
      activeTimeSec,
      breakTimeSec,
      totalDistanceM: round1(totalDistance),
      avgSpeedKmh: avgKmh,
      maxSpeedKmh: maxKmh,
      insights: insightBullets,
      intensityPeakCaption: peakCaption,
      intensity: {
        label: intensityLabel,
        score0to100,
        sparkline: sparklineFromIntensity(intensityByMinute),
      },
    },
    physicalByPlayer,
    positionalByPlayer,
    timelineByPlayer,
    replay: {
      videoSrc: opts.highlightsVideoUrl,
      overlays: [
        { id: "tracks", label: "Tracks", defaultOn: true },
        { id: "court", label: "Court lines", defaultOn: true },
        { id: "zones", label: "Zones", defaultOn: false },
        { id: "speed", label: "Speed tint", defaultOn: false },
      ],
      highlights: replayHighlights,
    },
  };
}
