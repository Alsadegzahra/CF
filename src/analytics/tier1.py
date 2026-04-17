"""
Tier 1 — basic analytics (session totals, per-player distance & share, one insight).

**Distance (meters)**  
Court coordinates `(x_court, y_court)` are normalized to [0,1] × [0,1] with physical size
`COURT_WIDTH_M` × `COURT_HEIGHT_M` (padel doubles: 10 m × 20 m). For consecutive track samples
`p0 → p1` with valid court points:

  Δx_m = (x1 − x0) × COURT_WIDTH_M  
  Δy_m = (y1 − y0) × COURT_HEIGHT_M  
  segment_length_m = √(Δx_m² + Δy_m²)

Per-player **distance_m** = sum of segment lengths along that player’s time-ordered track.
**total_distance_m** = sum of per-player distances (not deduplicating overlap — each player’s path is separate).

**Active duration (seconds)**  
Per player: time from first to last track sample — `timestamp` difference if both present,
else `(max_frame − min_frame) / fps`.

**Clip length**  
`video_meta["duration_seconds"]` — full media length (wall clock), not identical to tracking span.

**Rank / share**  
Players sorted by `distance_m` descending → `rank_by_distance` = 1…N.  
`share_of_distance_pct` = 100 × distance_m / total_distance_m (0 if total is 0).

**Players counted**  
Distinct `player_id` values that have at least one track row with a valid court point.

Uses: tracks list (dicts with player_id, frame, optional timestamp, x_court, y_court).
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

from src.config.constants import COURT_HEIGHT_M, COURT_WIDTH_M

from src.analytics.movement import _get_court_point


def _segment_length_m(p0: Tuple[float, float], p1: Tuple[float, float]) -> float:
    dx = (p1[0] - p0[0]) * COURT_WIDTH_M
    dy = (p1[1] - p0[1]) * COURT_HEIGHT_M
    return float((dx * dx + dy * dy) ** 0.5)


def _sort_key_track(t: dict, fps: float) -> float:
    ts = t.get("timestamp")
    if ts is not None:
        return float(ts)
    return float(t.get("frame", 0)) / (fps or 30.0)


def _active_duration_s(list_t: List[dict], fps: float) -> float:
    if len(list_t) < 2:
        return 0.0
    list_t = sorted(list_t, key=lambda t: _sort_key_track(t, fps))
    t0, t1 = list_t[0], list_t[-1]
    ts0 = t0.get("timestamp")
    ts1 = t1.get("timestamp")
    if ts0 is not None and ts1 is not None and float(ts1) > float(ts0):
        return float(ts1) - float(ts0)
    fr0 = [t.get("frame") for t in list_t if t.get("frame") is not None]
    if fr0 and fps > 0:
        return (max(fr0) - min(fr0)) / fps
    return 0.0


def _path_length_m(list_t: List[dict], fps: float) -> float:
    """Sum of segment lengths in meters; list_t sorted internally."""
    if len(list_t) < 2:
        return 0.0
    lst = sorted(list_t, key=lambda t: _sort_key_track(t, fps))
    total = 0.0
    for i in range(1, len(lst)):
        p0 = _get_court_point(lst[i - 1])
        p1 = _get_court_point(lst[i])
        if p0 is None or p1 is None:
            continue
        total += _segment_length_m(p0, p1)
    return total


def build_tier1(
    tracks: List[dict],
    video_meta: Dict[str, Any],
    *,
    fps: float,
) -> Dict[str, Any]:
    """
    Build the tier_1 payload for report.json. Safe with empty tracks.
    """
    clip_s = float(video_meta.get("duration_seconds") or 0.0)
    fps = float(fps or 30.0)

    empty = {
        "tier": 1,
        "label": "basic",
        "meta": {
            "distance_unit": "m",
            "court_width_m": COURT_WIDTH_M,
            "court_height_m": COURT_HEIGHT_M,
            "description": "Path length uses Euclidean segments in physical court meters.",
        },
        "session": {
            "clip_length_s": round(clip_s, 2),
            "num_players": 0,
            "total_distance_m": 0.0,
            "tracking_span_s": 0.0,
            "total_track_points": 0,
        },
        "players": {},
        "insight": "No track data — run detection to see tier 1 analytics.",
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
        out = dict(empty)
        out["insight"] = "No mapped court coordinates — run calibration and coordinate mapping."
        return out

    players_out: Dict[str, Any] = {}
    total_distance = 0.0
    tracking_span = 0.0

    for pid in sorted(by_player.keys()):
        lst = by_player[pid]
        dist_m = round(_path_length_m(lst, fps), 2)
        dur = round(_active_duration_s(lst, fps), 2)
        total_distance += dist_m
        if dur > tracking_span:
            tracking_span = dur
        players_out[str(pid)] = {
            "distance_m": dist_m,
            "active_duration_s": dur,
            "track_points": len(lst),
        }

    total_distance = round(total_distance, 2)
    tracking_span = round(tracking_span, 2)

    # Rank by distance (1 = most distance)
    ranked = sorted(players_out.items(), key=lambda x: -x[1]["distance_m"])
    for rank, (pid, row) in enumerate(ranked, start=1):
        row["rank_by_distance"] = rank
        row["share_of_distance_pct"] = (
            round(100.0 * row["distance_m"] / total_distance, 1) if total_distance > 0 else 0.0
        )

    n = len(by_player)
    most_pid = ranked[0][0] if ranked else None
    most_m = ranked[0][1]["distance_m"] if ranked else 0.0
    pl = "player" if n == 1 else "players"
    insight = (
        f"{n} {pl} · {total_distance:.0f} m total · ~{tracking_span:.0f} s tracking span"
        + (f" · Most active: P{most_pid} ({most_m:.0f} m)" if most_pid is not None else "")
    )

    return {
        "tier": 1,
        "label": "basic",
        "meta": {
            "distance_unit": "m",
            "court_width_m": COURT_WIDTH_M,
            "court_height_m": COURT_HEIGHT_M,
            "description": "Path length uses Euclidean segments in physical court meters.",
        },
        "session": {
            "clip_length_s": round(clip_s, 2),
            "num_players": n,
            "total_distance_m": total_distance,
            "tracking_span_s": tracking_span,
            "total_track_points": len(tracks),
        },
        "players": players_out,
        "insight": insight,
    }
