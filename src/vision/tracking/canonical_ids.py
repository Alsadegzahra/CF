"""
Map many tracker IDs to canonical 4 players (1..4) for padel.
- canonicalize_from_first_frame: pick 4 from first frame; re-anchor when those IDs disappear so we don't drop the rest of the video.
- canonicalize_to_four_players: by frequency (legacy).
When calibration (homography) is available, we order by court side (left/right of net) so P1,P2 and P3,P4 stay consistent.
"""
from __future__ import annotations

from collections import Counter
from typing import Dict, List, Optional, Tuple, TYPE_CHECKING

from src.vision.tracking.ground_point import bbox_to_ground_point

if TYPE_CHECKING:
    from src.domain.models import CalibrationHomography

# Court x where net sits (normalized 0–1); left = x < NET_X_COURT, right = x >= NET_X_COURT
NET_X_COURT = 0.5


def _dist_sq(ax: float, ay: float, bx: float, by: float) -> float:
    return (ax - bx) ** 2 + (ay - by) ** 2


def _pick_four_from_frame_tracks(
    frame_tracks: List[dict],
    n_players: int,
    court_center: Optional[Tuple[float, float]],
    calib: Optional["CalibrationHomography"] = None,
) -> Tuple[List[int], Dict[int, int]]:
    """From one frame's tracks, pick n_players by court side (if calib) or court_center/position; return (chosen_tids, old_to_canon)."""
    tid_to_bbox: Dict[int, list] = {}
    for t in frame_tracks:
        pid = t.get("player_id")
        if pid is None:
            continue
        pid = int(pid)
        if pid not in tid_to_bbox:
            tid_to_bbox[pid] = t.get("bbox_xyxy") or [0, 0, 0, 0]
    if not tid_to_bbox:
        return [], {}

    if calib is not None:
        from src.vision.mapping.img_to_court import pixel_to_court
        # Order by court side (left of net first), then by court y (baseline), then x
        def order_key(item):
            tid, bbox = item
            x, y = bbox_to_ground_point(bbox)
            xc, yc = pixel_to_court(x, y, calib)
            # Left half (x_court < net) first; then by -y_court (higher y = closer to net), then x_court
            side_left = 0 if xc < NET_X_COURT else 1
            return (side_left, -yc, xc)
        ordered = sorted(tid_to_bbox.items(), key=order_key)[:n_players]
    else:
        def order_key(item):
            tid, bbox = item
            x, y = bbox_to_ground_point(bbox)
            if court_center is not None:
                cx, cy = court_center
                return _dist_sq(x, y, cx, cy)
            return (-y, x)
        ordered = sorted(tid_to_bbox.items(), key=order_key)[:n_players]

    chosen = [tid for tid, _ in ordered]
    old_to_canon = {tid: i + 1 for i, tid in enumerate(chosen)}
    return chosen, old_to_canon


# Frames with none of our chosen IDs before we re-anchor (60 = ~2 sec @ 30fps; avoid re-anchoring too soon)
REANCHOR_GAP_FRAMES = 60


def canonicalize_from_first_frame(
    tracks: List[dict],
    n_players: int = 4,
    court_center: Optional[Tuple[float, float]] = None,
    calib: Optional["CalibrationHomography"] = None,
) -> List[dict]:
    """
    Pick the n_players from the first frame, then filter and remap to 1..n.
    When our chosen 4 IDs disappear for REANCHOR_GAP_FRAMES, re-anchor: pick 4 from the next
    frame that has 4 detections, so the rest of the video still gets IDs (no "all lost").
    - court_center: (pixel) sort by distance to court center when calib is None; else by position (-y, x).
    - calib: when set, order by court side (left/right of net) then court y so P1,P2 and P3,P4 are stable by half.
    """
    if not tracks or n_players < 1:
        return list(tracks)

    valid = [t for t in tracks if t.get("player_id") is not None]
    if not valid:
        return list(tracks)

    ids_present = {t["player_id"] for t in valid}
    allowed = set(range(1, n_players + 1))
    if ids_present <= allowed and len(ids_present) <= n_players:
        return list(tracks)

    by_frame: Dict[int, List[dict]] = {}
    for t in tracks:
        f = t.get("frame")
        if f is None:
            continue
        by_frame.setdefault(f, []).append(t)
    if not by_frame:
        return list(tracks)

    frames_sorted = sorted(by_frame.keys())
    # segments: (start_frame, old_to_canon); for frame f use segment with largest start_frame <= f
    segments: List[Tuple[int, Dict[int, int]]] = []
    chosen: Optional[set] = None
    gap_start: Optional[int] = None

    for f in frames_sorted:
        frame_tracks = by_frame[f]
        tids_in_f = {t["player_id"] for t in frame_tracks if t.get("player_id") is not None}
        if not tids_in_f:
            if chosen is not None:
                if gap_start is None:
                    gap_start = f
            continue

        if chosen is None:
            # Initial pick: first frame with at least n_players
            if len(tids_in_f) >= n_players:
                chosen_list, old_to_canon = _pick_four_from_frame_tracks(
                    frame_tracks, n_players, court_center, calib
                )
                if old_to_canon:
                    chosen = set(chosen_list)
                    segments.append((f, old_to_canon))
            continue

        overlap = len(tids_in_f & chosen)
        # Re-anchor when this frame has 4 IDs but at least one is not in our chosen set
        # (tracker has moved to different IDs → adopt current 4 so we don't show "?" for half the video)
        if chosen is not None and len(tids_in_f) >= n_players and overlap < n_players:
            chosen_list, old_to_canon = _pick_four_from_frame_tracks(
                frame_tracks, n_players, court_center, calib
            )
            if old_to_canon:
                chosen = set(chosen_list)
                segments.append((f, old_to_canon))
            gap_start = None
        elif overlap == 0:
            if gap_start is None:
                gap_start = f
            elif f - gap_start >= REANCHOR_GAP_FRAMES:
                # Re-anchor: next frame with n_players distinct IDs (our 4 were gone for a while)
                for ff in frames_sorted:
                    if ff < f:
                        continue
                    tids_ff = {t["player_id"] for t in by_frame[ff] if t.get("player_id") is not None}
                    if len(tids_ff) >= n_players:
                        chosen_list, old_to_canon = _pick_four_from_frame_tracks(
                            by_frame[ff], n_players, court_center, calib
                        )
                        if old_to_canon:
                            chosen = set(chosen_list)
                            segments.append((ff, old_to_canon))
                            gap_start = None
                        break
        else:
            gap_start = None

    if not segments:
        return list(tracks)

    # For each track: find segment (largest start <= frame), apply mapping
    out = []
    for t in tracks:
        pid = t.get("player_id")
        if pid is None:
            continue
        f = t.get("frame")
        if f is None:
            continue
        # segment with largest start_frame <= f
        seg = None
        for start, mapping in segments:
            if start <= f:
                seg = mapping
            else:
                break
        if seg is not None and pid in seg:
            out.append({**t, "player_id": seg[pid], "original_track_id": pid})
    return out


def canonicalize_to_four_players(tracks: List[dict], n_players: int = 4) -> List[dict]:
    """
    Ensure player_id is in 1..n_players. Returns a new list; input is not mutated.
    - If all IDs are already in 1..n_players: return tracks as-is (preserve identity).
    - If we have IDs outside 1..n (e.g. from ByteTrack): take top n_players by count and remap to 1..n.
    """
    if not tracks or n_players < 1:
        return list(tracks)

    valid = [t for t in tracks if t.get("player_id") is not None]
    if not valid:
        return list(tracks)

    ids_present = {t["player_id"] for t in valid}
    allowed = set(range(1, n_players + 1))
    # Already canonical: all IDs in 1..n and at most n distinct
    if ids_present <= allowed and len(ids_present) <= n_players:
        return list(tracks)

    # Remap: take top n_players by frequency (for tracker output like 5, 7, 12, 99)
    counts = Counter(t["player_id"] for t in valid)
    most_common = counts.most_common(n_players)
    ordered = [tid for tid, _ in most_common]
    old_to_canon = {tid: i + 1 for i, tid in enumerate(ordered)}

    out = []
    for t in tracks:
        pid = t.get("player_id")
        if pid is None or pid not in old_to_canon:
            continue
        out.append({**t, "player_id": old_to_canon[pid]})
    return out
