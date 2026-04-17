"""
Manual net-floor quadrilateral for analytics overlay tint (image pixel corners).

Click order: go once around the net band on the floor (clockwise). Points are reordered
by polar angle around the centroid so the fill is valid for any starting corner.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np

from src.pipeline.paths import court_calibration_dir
from src.utils.io import read_json, write_json_atomic

NET_FLOOR_QUAD_FILENAME = "net_floor_quad.json"

NET_FLOOR_QUAD_LABELS = (
    "1. Net on floor — corner A (then go clockwise)",
    "2. Net on floor — corner B",
    "3. Net on floor — corner C",
    "4. Net on floor — corner D",
)


def order_quad_clockwise(pts: np.ndarray) -> np.ndarray:
    """Return 4×2 points sorted by polar angle around centroid (convex quad)."""
    p = np.asarray(pts, dtype=np.float64).reshape(-1, 2)
    if len(p) < 3:
        return p
    c = p.mean(axis=0)
    ang = np.arctan2(p[:, 1] - c[1], p[:, 0] - c[0])
    idx = np.argsort(ang)
    return p[idx]


def save_net_floor_quad_json(
    dest: Path,
    points_px: List[Tuple[int, int]],
    *,
    labels: Tuple[str, ...] = NET_FLOOR_QUAD_LABELS,
    image_width: int,
    image_height: int,
) -> None:
    dest = Path(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    payload: Dict[str, Any] = {
        "schema_version": "1",
        "points_px": [[float(x), float(y)] for x, y in points_px],
        "labels": list(labels),
        "image_width": int(image_width),
        "image_height": int(image_height),
    }
    write_json_atomic(dest, payload)


def _read_net_floor_data(match_dir: Path) -> Optional[Dict[str, Any]]:
    paths: List[Path] = [match_dir / "calibration" / NET_FLOOR_QUAD_FILENAME]
    try:
        meta = read_json(match_dir / "meta" / "meta.json")
        cid = meta.get("court_id") if isinstance(meta, dict) else None
        if cid:
            paths.append(court_calibration_dir(str(cid)) / NET_FLOOR_QUAD_FILENAME)
    except Exception:
        pass
    for p in paths:
        if not p.exists():
            continue
        try:
            data = read_json(p)
            if isinstance(data, dict) and isinstance(data.get("points_px"), list):
                return data
        except Exception:
            pass
    return None


def load_net_floor_quad_pixels(
    match_dir: Path,
    frame_width: int,
    frame_height: int,
) -> Optional[np.ndarray]:
    """
    Load net floor quad as int32 (4, 2) in **current video pixel coordinates**.
    Scales from saved image_width/height when they differ from the render resolution.
    """
    data = _read_net_floor_data(match_dir)
    if data is None:
        return None
    raw = data.get("points_px")
    if not isinstance(raw, list) or len(raw) != 4:
        return None
    try:
        pts = np.array([[float(p[0]), float(p[1])] for p in raw], dtype=np.float64)
    except (TypeError, ValueError, IndexError):
        return None
    iw = int(data.get("image_width") or 0)
    ih = int(data.get("image_height") or 0)
    if iw > 0 and ih > 0 and (iw != frame_width or ih != frame_height):
        pts[:, 0] *= float(frame_width) / float(iw)
        pts[:, 1] *= float(frame_height) / float(ih)
    ordered = order_quad_clockwise(pts)
    return np.round(ordered).astype(np.int32)
