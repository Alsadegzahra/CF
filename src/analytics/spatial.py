"""
Spatial analytics: zone coverage, net vs baseline %, team spacing.
Court coordinates: x, y in [0, 1]; y=0.5 is net, y=0 and y=1 are baselines.
"""
from __future__ import annotations

from typing import Any, Dict, List, Tuple

from src.analytics.movement import _get_court_point


# Net region: middle 20% of court length (y)
NET_Y_LOW = 0.4
NET_Y_HI = 0.6

# 6 zones: 2 (x: left/right) × 3 (y: back, mid, net)
def _zone_index(x: float, y: float) -> int:
    """Zone 0..5: 0=left-back, 1=left-mid, 2=left-net, 3=right-back, 4=right-mid, 5=right-net."""
    if x < 0.5:
        col = 0
    else:
        col = 1
    if y < 0.33:
        row = 0
    elif y < 0.66:
        row = 1
    else:
        row = 2
    return col * 3 + row


def compute_zone_coverage(tracks: List[dict]) -> Dict[str, Dict[int, float]]:
    """Per-player % of time (point count) in each of 6 zones. Returns {player_id: {zone_index: pct}}."""
    by_player: Dict[str, List[Tuple[float, float]]] = {}
    for t in tracks:
        pt = _get_court_point(t)
        if pt is None:
            continue
        pid = str(t.get("player_id", ""))
        by_player.setdefault(pid, []).append(pt)
    out: Dict[str, Dict[int, float]] = {}
    for pid, points in by_player.items():
        n = len(points)
        counts: Dict[int, int] = {}
        for (x, y) in points:
            z = _zone_index(x, y)
            counts[z] = counts.get(z, 0) + 1
        out[pid] = {z: round(100.0 * counts.get(z, 0) / n, 1) for z in range(6)} if n else {}
    return out


def compute_net_baseline_pct(tracks: List[dict]) -> Dict[str, Dict[str, float]]:
    """Per-player % of time near net vs baseline. Returns {player_id: {net_pct, baseline_pct}}."""
    by_player: Dict[str, List[float]] = {}
    for t in tracks:
        y = t.get("y_court")
        if y is None:
            continue
        y = float(y)
        pid = str(t.get("player_id", ""))
        by_player.setdefault(pid, []).append(y)
    out: Dict[str, Dict[str, float]] = {}
    for pid, ys in by_player.items():
        n = len(ys)
        if n == 0:
            out[pid] = {"net_pct": 0.0, "baseline_pct": 0.0}
            continue
        net_count = sum(1 for y in ys if NET_Y_LOW <= y <= NET_Y_HI)
        baseline_count = n - net_count
        out[pid] = {
            "net_pct": round(100.0 * net_count / n, 1),
            "baseline_pct": round(100.0 * baseline_count / n, 1),
        }
    return out


def compute_team_spacing(tracks: List[dict], scale: float = 10.0) -> Dict[str, Any]:
    """
    Team spacing: assume P1,P2 = team 1, P3,P4 = team 2.
    Returns {team_1_avg_m, team_2_avg_m, per_frame: [{frame, d1, d2}]} for optional viz.
    """
    by_frame: Dict[int, Dict[str, Tuple[float, float]]] = {}
    for t in tracks:
        pt = _get_court_point(t)
        if pt is None:
            continue
        frame = t.get("frame", 0)
        pid = str(t.get("player_id", ""))
        if frame not in by_frame:
            by_frame[frame] = {}
        by_frame[frame][pid] = pt
    d1_list: List[float] = []
    d2_list: List[float] = []
    for frame, pos in by_frame.items():
        if "1" in pos and "2" in pos:
            p1, p2 = pos["1"], pos["2"]
            d = ((p2[0] - p1[0]) ** 2 + (p2[1] - p1[1]) ** 2) ** 0.5 * scale
            d1_list.append(d)
        if "3" in pos and "4" in pos:
            p3, p4 = pos["3"], pos["4"]
            d = ((p4[0] - p3[0]) ** 2 + (p4[1] - p3[1]) ** 2) ** 0.5 * scale
            d2_list.append(d)
    n1, n2 = len(d1_list), len(d2_list)
    return {
        "team_1_avg_m": round(sum(d1_list) / n1, 2) if n1 else 0.0,
        "team_2_avg_m": round(sum(d2_list) / n2, 2) if n2 else 0.0,
    }
