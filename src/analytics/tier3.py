"""
Tier 3 — detailed spatial and dynamics: zones, net/baseline split, lateral %,
acceleration/deceleration counts, team spacing, high-intensity windows.

**Zone coverage** — From `spatial.compute_zone_coverage`: % of track samples in each of 6 zones
(2×3 grid: left/right × back/mid/net). Keys 0–5 in the JSON.

**Net / baseline %** — Time near net band vs rest (`spatial.compute_net_baseline_pct`).

**Lateral movement %** — Share of path length that is lateral (|Δx|) vs total, from movement metrics.

**Acceleration / deceleration counts** — Segment-to-segment speed change peaks (`movement.compute_movement_metrics`).

**Team spacing** — Mean distance between P1–P2 and P3–P4 in court units × scale (meters) per `compute_team_spacing`.

**Intensity** — Count of highlight windows from `intensity_timeline` (high movement segments); list of windows in report `highlights`.
"""
from __future__ import annotations

from typing import Any, Dict, List


def build_tier3(
    players: Dict[str, Any],
    *,
    team_spacing: Dict[str, Any],
    highlights: List[dict],
) -> Dict[str, Any]:
    """
    Assemble tier_3 from enriched `players` (after zone/net + movement metrics).
    Safe with empty players.
    """
    meta = {
        "zones": "6 cells: team half A and B (sides of net) x back/mid/net each; x ignored (see spatial._zone_index)",
        "net_band": "y_court in [NET_Y_LOW, NET_Y_HI] for net_pct vs baseline_pct (full corridor around net)",
        "team_spacing": "P1-P2 and P3-P4 mean separation (m), court-normalized distance x scale",
    }

    empty = {
        "tier": 3,
        "label": "detailed",
        "meta": meta,
        "session": {
            "high_intensity_windows": 0,
            "team_1_avg_spacing_m": 0.0,
            "team_2_avg_spacing_m": 0.0,
        },
        "players": {},
    }

    if not players:
        return empty

    ts = team_spacing or {}
    session = {
        "high_intensity_windows": len(highlights or []),
        "team_1_avg_spacing_m": ts.get("team_1_avg_m", 0.0),
        "team_2_avg_spacing_m": ts.get("team_2_avg_m", 0.0),
    }

    players_out: Dict[str, Any] = {}
    for pid in sorted(players.keys(), key=lambda x: int(x) if str(x).isdigit() else 0):
        p = players.get(pid) or {}
        zc = p.get("zone_coverage_pct")
        if isinstance(zc, dict):
            zc_out = {str(k): v for k, v in zc.items()}
        else:
            zc_out = {}
        players_out[str(pid)] = {
            "zone_coverage_pct": zc_out,
            "net_pct": round(float(p.get("net_pct") or 0), 1),
            "baseline_pct": round(float(p.get("baseline_pct") or 0), 1),
            "lateral_movement_pct": round(float(p.get("lateral_movement_pct") or 0), 1),
            "acceleration_peaks": int(p.get("acceleration_peaks") or 0),
            "deceleration_count": int(p.get("deceleration_count") or 0),
        }

    return {
        "tier": 3,
        "label": "detailed",
        "meta": meta,
        "session": session,
        "players": players_out,
    }
