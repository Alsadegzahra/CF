"""
Tier 2 — standard load metrics: speed (avg / max), sprint bursts, heatmap file references.

**Speeds (m/s)**  
Uses the same physical segment length as Tier 1 (10 m × 20 m court, anisotropic).
For each consecutive pair of samples with valid court points:

  segment_m = sqrt(Δx_m² + Δy_m²)  
  Δt = timestamp delta, or (frame delta) / fps  
  segment_speed_m_s = segment_m / Δt

**avg_speed_m_s** — Path length (m) divided by **active_duration_s** (first→last sample time).
This matches “how fast they covered their path on average,” not the mean of segment speeds.

**max_speed_m_s** — Maximum of per-segment speeds (m/s).

**sprint_count** — From `movement._sprint_count` on **clamped** segment speeds (each segment capped at
`MAX_SEGMENT_SPEED_M_S`, default 12 m/s) so single-frame jumps do not dominate. Threshold 4 m/s unchanged.

**max_speed_m_s** — Max of clamped segment speeds (physically plausible cap per segment).

**Heatmaps** — Paths are relative to the match directory (e.g. `reports/heatmap.png`); files are
produced by `build_heatmap` in the report stage.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from src.analytics.movement import (
    SPRINT_MIN_SEGMENTS,
    SPRINT_SPEED_THRESHOLD_M_S,
    _get_court_point,
    _sprint_count,
)
from src.analytics.tier1 import (
    _active_duration_s,
    _path_length_m,
    _segment_length_m,
    _sort_key_track,
)

# Padel court: cap segment speed for max/sprint stats (reduces single-frame calibration noise).
MAX_SEGMENT_SPEED_M_S = 12.0


def _segment_speeds_m_s(list_t: List[dict], fps: float) -> List[float]:
    """Per-segment speeds in m/s; same ordering as time-ordered track."""
    if len(list_t) < 2:
        return []
    lst = sorted(list_t, key=lambda t: _sort_key_track(t, fps))
    speeds: List[float] = []
    for i in range(1, len(lst)):
        p0 = _get_court_point(lst[i - 1])
        p1 = _get_court_point(lst[i])
        if p0 is None or p1 is None:
            continue
        seg_m = _segment_length_m(p0, p1)
        ts0 = lst[i - 1].get("timestamp")
        ts1 = lst[i].get("timestamp")
        if ts0 is not None and ts1 is not None and float(ts1) > float(ts0):
            dt = float(ts1) - float(ts0)
        else:
            fr0 = lst[i - 1].get("frame")
            fr1 = lst[i].get("frame")
            if fr0 is None or fr1 is None or fps <= 0:
                continue
            dt = (float(fr1) - float(fr0)) / fps
        if dt > 0:
            speeds.append(seg_m / dt)
    return speeds


def build_tier2(
    tracks: List[dict],
    video_meta: Dict[str, Any],
    *,
    fps: float,
    heatmap_paths: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Build tier_2 for report.json. heatmap_paths may include:
      combined: str, per_player: { "1": str, ... }
    """
    fps = float(fps or 30.0)
    meta_block = {
        "sprint_threshold_m_s": SPRINT_SPEED_THRESHOLD_M_S,
        "sprint_min_consecutive_segments": SPRINT_MIN_SEGMENTS,
        "segment_speed_cap_m_s": MAX_SEGMENT_SPEED_M_S,
        "speed_unit_m_s": "m/s",
        "speed_unit_kmh": "km/h (derived as m/s × 3.6)",
        "avg_speed_definition": "distance_m / active_duration_s (path average, not mean of segments)",
        "max_speed_definition": "max of per-segment speeds after capping each segment at segment_speed_cap_m_s",
    }

    empty = {
        "tier": 2,
        "label": "standard",
        "meta": meta_block,
        "session": {"heatmaps": heatmap_paths or {}},
        "players": {},
    }

    if not tracks:
        return empty

    by_player: Dict[int, List[dict]] = {}
    for t in tracks:
        pid = t.get("player_id")
        if pid is None:
            continue
        if _get_court_point(t) is None:
            continue
        by_player.setdefault(int(pid), []).append(t)

    if not by_player:
        return {**empty, "session": {**empty["session"], "note": "no mapped court coordinates"}}

    players_out: Dict[str, Any] = {}
    for pid in sorted(by_player.keys()):
        lst = by_player[pid]
        dist_m = round(_path_length_m(lst, fps), 2)
        active_s = _active_duration_s(lst, fps)
        speeds = _segment_speeds_m_s(lst, fps)
        speeds_capped = [min(v, MAX_SEGMENT_SPEED_M_S) for v in speeds]
        max_v = max(speeds_capped) if speeds_capped else 0.0
        avg_v = (dist_m / active_s) if active_s > 0 else 0.0
        sprints = _sprint_count(speeds_capped)

        players_out[str(pid)] = {
            "distance_m": dist_m,
            "active_duration_s": round(active_s, 2),
            "avg_speed_m_s": round(avg_v, 3),
            "avg_speed_kmh": round(avg_v * 3.6, 2),
            "max_speed_m_s": round(max_v, 3),
            "max_speed_kmh": round(max_v * 3.6, 2),
            "sprint_count": sprints,
        }

    # Session roll-ups
    all_max = max((p["max_speed_m_s"] for p in players_out.values()), default=0.0)
    total_sprints = sum(p["sprint_count"] for p in players_out.values())

    return {
        "tier": 2,
        "label": "standard",
        "meta": meta_block,
        "session": {
            "heatmaps": heatmap_paths or {},
            "max_speed_m_s_any_player": round(all_max, 3),
            "sprint_count_all_players": total_sprints,
        },
        "players": players_out,
    }
