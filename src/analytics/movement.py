"""
Distances/speeds/coverage from tracks (list of dicts with timestamp, player_id, x_court, y_court).
Uses: tracks JSON or list of track dicts.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional, Tuple

# Sprint: speed (m/s) above this counts as sprint. ~4 m/s ≈ 14.4 km/h.
SPRINT_SPEED_THRESHOLD_M_S = 4.0
# Min consecutive segments (at ~30 fps, 3 segments ≈ 0.1 s) to count one sprint burst.
SPRINT_MIN_SEGMENTS = 3
# Acceleration/deceleration: m/s² threshold for "peak" (rapid change).
ACCEL_PEAK_THRESHOLD = 2.0


def _get_court_point(t: dict) -> Optional[Tuple[float, float]]:
    x = t.get("x_court")
    y = t.get("y_court")
    if x is None or y is None:
        return None
    return (float(x), float(y))


def _segment_speeds_and_lateral(
    list_t: List[dict],
    scale: float,
    fps: float,
) -> Tuple[List[float], float, float, float]:
    """Compute per-segment speeds (m/s), total distance (m), and lateral (x) displacement sum.
    Returns (speeds, total_dist_m, lateral_abs_sum, total_duration_s).
    Distance = path_length_court * scale (same as main loop).
    """
    speeds: List[float] = []
    total_dist = 0.0
    lateral_abs = 0.0
    duration_s = 0.0
    for i in range(1, len(list_t)):
        p0 = _get_court_point(list_t[i - 1])
        p1 = _get_court_point(list_t[i])
        if p0 is None or p1 is None:
            continue
        seg_court = ((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2) ** 0.5
        seg_m = seg_court * scale
        total_dist += seg_m
        lateral_abs += abs(p1[0] - p0[0]) * scale
        ts0 = list_t[i - 1].get("timestamp")
        ts1 = list_t[i].get("timestamp")
        if ts0 is not None and ts1 is not None and (ts1 - ts0) > 0:
            dt = ts1 - ts0
            duration_s += dt
            speeds.append(seg_m / dt)
        elif fps and fps > 0:
            fr0 = list_t[i - 1].get("frame", 0)
            fr1 = list_t[i].get("frame", 0)
            dt = (fr1 - fr0) / fps
            if dt > 0:
                duration_s += dt
                speeds.append(seg_m / dt)
    return (speeds, total_dist, lateral_abs, duration_s)


def _sprint_count(speeds: List[float]) -> int:
    """Count runs of consecutive segments above SPRINT_SPEED_THRESHOLD_M_S (min SPRINT_MIN_SEGMENTS)."""
    n = 0
    run = 0
    for v in speeds:
        if v >= SPRINT_SPEED_THRESHOLD_M_S:
            run += 1
        else:
            if run >= SPRINT_MIN_SEGMENTS:
                n += 1
            run = 0
    if run >= SPRINT_MIN_SEGMENTS:
        n += 1
    return n


def _accel_decel_counts(speeds: List[float], dts: Optional[List[float]] = None) -> Tuple[int, int]:
    """From list of segment speeds, compute acceleration between segments; count peaks and decel spikes.
    If dts not provided, assume uniform 1/30 s.
    Returns (acceleration_peaks, deceleration_load_count).
    """
    if len(speeds) < 2:
        return (0, 0)
    if dts is None:
        dts = [1.0 / 30.0] * (len(speeds) - 1)
    while len(dts) < len(speeds) - 1:
        dts.append(1.0 / 30.0)
    accel_peaks = 0
    decel_count = 0
    for i in range(len(speeds) - 1):
        dt = dts[i] if i < len(dts) else (1.0 / 30.0)
        if dt <= 0:
            continue
        a = (speeds[i + 1] - speeds[i]) / dt
        if a >= ACCEL_PEAK_THRESHOLD:
            accel_peaks += 1
        if a <= -ACCEL_PEAK_THRESHOLD:
            decel_count += 1
    return (accel_peaks, decel_count)


def compute_movement_metrics(
    tracks: List[dict],
    *,
    court_scale_to_meters: Optional[float] = None,
    fps: Optional[float] = None,
) -> Dict[str, Any]:
    """
    Compute per-player and aggregate movement from tracks.
    Tracks must have: player_id, x_court, y_court; and either timestamp or frame.
    Returns:
      summary: total_distance, total_duration_s, num_players, total_track_points
      players: { str(player_id): { distance, duration_s, avg_speed, point_count } }
    Court coordinates are in calibration units; if court_scale_to_meters is set (e.g. court
    width in meters for normalized 0–1), distances are scaled to meters.
    If timestamp is missing or duration would be zero, duration is derived from frame range
    when fps is provided.
    """
    if not tracks:
        return {
            "summary": {
                "total_distance": 0.0,
                "total_duration_s": 0.0,
                "num_players": 0,
                "total_track_points": 0,
            },
            "players": {},
        }

    scale = court_scale_to_meters if court_scale_to_meters is not None else 1.0

    by_player: Dict[int, List[dict]] = {}
    for t in tracks:
        pid = t.get("player_id")
        if pid is None:
            continue
        pt = _get_court_point(t)
        if pt is None:
            continue
        by_player.setdefault(int(pid), []).append(t)

    players_out: Dict[str, Any] = {}
    total_distance = 0.0
    total_duration = 0.0
    total_points = len(tracks)

    for pid, list_t in by_player.items():
        # Sort by timestamp if present, else by frame (so order is correct)
        def _sort_key(t: dict) -> float:
            ts = t.get("timestamp")
            if ts is not None:
                return float(ts)
            return (t.get("frame", 0) / (fps or 1.0))
        list_t = sorted(list_t, key=_sort_key)
        if len(list_t) < 2:
            players_out[str(pid)] = {
                "distance": 0.0,
                "duration_s": 0.0,
                "avg_speed": 0.0,
                "point_count": len(list_t),
            }
            continue
        duration_s = (list_t[-1].get("timestamp") or 0) - (list_t[0].get("timestamp") or 0)
        if duration_s <= 0 and fps and fps > 0:
            frames = [t.get("frame") for t in list_t if t.get("frame") is not None]
            if frames:
                duration_s = (max(frames) - min(frames)) / fps
        if duration_s <= 0:
            duration_s = 0.0
            dist = 0.0
            max_speed = 0.0
            sprint_count = 0
            acceleration_peaks = 0
            deceleration_count = 0
            lateral_movement_pct = 0.0
        else:
            speeds, dist, lateral_abs, _ = _segment_speeds_and_lateral(list_t, scale, fps)
            max_speed = max(speeds) if speeds else 0.0
            sprint_count = _sprint_count(speeds)
            acceleration_peaks, deceleration_count = _accel_decel_counts(speeds)
            lateral_movement_pct = round(100.0 * lateral_abs / dist, 1) if dist > 0 else 0.0
        avg_speed = (dist / duration_s) if duration_s > 0 else 0.0
        players_out[str(pid)] = {
            "distance": round(dist, 2),
            "duration_s": round(duration_s, 2),
            "avg_speed": round(avg_speed, 4),
            "max_speed": round(max_speed, 4),
            "sprint_count": sprint_count,
            "acceleration_peaks": acceleration_peaks,
            "deceleration_count": deceleration_count,
            "lateral_movement_pct": lateral_movement_pct,
            "point_count": len(list_t),
        }
        total_distance += dist
        if duration_s > total_duration:
            total_duration = duration_s

    return {
        "summary": {
            "total_distance": round(total_distance, 2),
            "total_duration_s": round(total_duration, 2),
            "num_players": len(by_player),
            "total_track_points": total_points,
        },
        "players": players_out,
    }


def intensity_timeline(
    tracks: List[dict],
    *,
    window_s: float = 10.0,
    fps: Optional[float] = None,
    court_scale_to_meters: Optional[float] = None,
) -> List[Dict[str, Any]]:
    """
    Compute movement intensity (average speed in m/s) per time window across all players.
    Returns list of {start_s, end_s, intensity}. Used for motion-based highlight selection.
    """
    if not tracks or fps is None or fps <= 0:
        return []
    scale = court_scale_to_meters if court_scale_to_meters is not None else 1.0
    by_player: Dict[int, List[dict]] = {}
    for t in tracks:
        if _get_court_point(t) is None:
            continue
        pid = t.get("player_id")
        if pid is None:
            continue
        by_player.setdefault(int(pid), []).append(t)
    segments: List[Tuple[float, float]] = []  # (t_mid_s, speed_m_s)
    for pid, list_t in by_player.items():
        def _sort_key(x: dict) -> float:
            ts = x.get("timestamp")
            if ts is not None:
                return float(ts)
            return (x.get("frame", 0) / (fps or 1.0))
        list_t = sorted(list_t, key=_sort_key)
        for i in range(1, len(list_t)):
            p0 = _get_court_point(list_t[i - 1])
            p1 = _get_court_point(list_t[i])
            if p0 is None or p1 is None:
                continue
            seg = ((p1[0] - p0[0]) ** 2 + (p1[1] - p0[1]) ** 2) ** 0.5 * scale
            ts0 = list_t[i - 1].get("timestamp")
            ts1 = list_t[i].get("timestamp")
            if ts0 is not None and ts1 is not None and (ts1 - ts0) > 0:
                dt = ts1 - ts0
                t_mid = (ts0 + ts1) * 0.5
                segments.append((t_mid, seg / dt))
            elif fps and fps > 0:
                f0 = list_t[i - 1].get("frame", 0)
                f1 = list_t[i].get("frame", 0)
                dt = (f1 - f0) / fps
                if dt > 0:
                    t_mid = (f0 + f1) * 0.5 / fps
                    segments.append((t_mid, seg / dt))
    if not segments:
        return []
    t_min = min(s[0] for s in segments)
    t_max = max(s[0] for s in segments)
    out: List[Dict[str, Any]] = []
    start_s = max(0.0, t_min - window_s * 0.5)
    while start_s < t_max + window_s:
        end_s = start_s + window_s
        in_window = [speed for t_mid, speed in segments if start_s <= t_mid < end_s]
        intensity = (sum(in_window) / len(in_window)) if in_window else 0.0
        out.append({"start_s": round(start_s, 1), "end_s": round(end_s, 1), "intensity": round(intensity, 4)})
        start_s = end_s
    return out
