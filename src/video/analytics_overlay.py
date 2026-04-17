"""
Full analytics-style overlay video: bboxes + optional pose, HUD (frame/time/stats),
mini court map, explicit false for unavailable ball/rally/stroke.
Uses: tracks.json (x_court/y_court), tracks_raw.json (bbox, keypoints).
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2
import numpy as np

from src.analytics.spatial import (
    NET_ATTACK_DEPTH_M,
    NET_Y_HI,
    NET_Y_LOW,
    SERVICE_LINE_NORM,
    _zone_index,
)
from src.domain.models import CalibrationHomography
from src.vision.mapping.img_to_court import pixel_to_court
from src.court.calibration.court_keypoints import (
    SERVICE_LINE_FROM_BASELINE_M,
    get_court_dst,
    get_court_labels,
    get_court_overlay_short_labels,
)
from src.court.calibration.homography import load_homography
from src.court.calibration.net_floor_quad import load_net_floor_quad_pixels
from src.config.constants import COURT_HEIGHT_M, COURT_WIDTH_M
from src.utils.io import read_json
from src.utils.io import write_json_atomic
from src.video.overlay import draw_tracks_on_frame, group_tracks_by_frame

# Cap encode length to avoid accidental multi-hour encodes (0 = no cap)
DEFAULT_MAX_OVERLAY_SECONDS = 600

# Right minimap: two team colors (P1–P2 vs P3–P4, matches analytics team spacing convention).
MINIMAP_TEAM_A_BGR = (80, 180, 255)   # orange
MINIMAP_TEAM_B_BGR = (255, 160, 100)   # cyan
MINIMAP_DOT_RADIUS = 7
MINIMAP_ID_FS = 0.42

# Zone tints: one fill color per depth (all back cells, all mid, all net) — both team halves.
MINIMAP_TINT_BACK = (175, 185, 200)
MINIMAP_TINT_MID = (72, 128, 82)
MINIMAP_TINT_NET = (208, 198, 185)
MINIMAP_TINT_ALPHA = 0.36

# Short labels on minimap (matches A/B team halves x back/mid/net; Am/Bm shown in L/R mid cells).
MINIMAP_ZONE_LABELS = ("Ab", "Am", "Am", "An", "Bn", "Bm", "Bm", "Bb")
MINIMAP_LABEL_FS = 0.38
MINIMAP_LABEL_COLOR = (235, 240, 248)


def _minimap_player_bgr(pid: int) -> Tuple[int, int, int]:
    """Teammates share a color: team A = P1–P2, team B = P3–P4."""
    if pid in (1, 2):
        return MINIMAP_TEAM_A_BGR
    return MINIMAP_TEAM_B_BGR


# Net floor band: the real net is vertical; this is a floor strip at normalized y=0.5 projected
# through the same image→court homography as everything else. Aligning that line with the
# physical net usually needs 12-point calibration (net + service clicks); a future option is
# an explicit net-only constraint if we model height/occlusion separately.
NET_BAND_HALF_WIDTH_NORM = 0.014
NET_TINT_BGR = (55, 210, 255)  # soft yellow (BGR)
NET_TINT_ALPHA = 0.22
NET_LABEL_FS = 0.42
NET_LABEL_BGR = (35, 85, 150)  # dark text on yellow tint
# Manual net-floor quad (calibrate-net-floor): semi-transparent red fill in image pixels.
NET_MANUAL_TINT_BGR = (50, 50, 230)
NET_MANUAL_TINT_ALPHA = 0.24

# Same order as spatial._zone_index: team half A (y<0.5) then half B (y>0.5), × back/mid/net.
_ZONE_NAMES = ("A-back", "A-mid", "A-net", "B-back", "B-mid", "B-net")


def _norm_court_xy_from_track(
    t: dict,
    calib: Optional[CalibrationHomography],
    cw: float,
    ch: float,
) -> Optional[Tuple[float, float]]:
    """
    Normalized court position (0-1) for HUD + minimap.
    Prefer x_court/y_court from mapping (meters); else pixel_to_court if calib + x_pixel/y_pixel.
    Values already in [0,1] are treated as legacy normalized.
    """
    xc = t.get("x_court")
    yc = t.get("y_court")
    if xc is not None and yc is not None:
        xf, yf = float(xc), float(yc)
        if 0.0 <= xf <= 1.0 and 0.0 <= yf <= 1.0:
            return (xf, yf)
        if cw > 1e-9 and ch > 1e-9:
            return (xf / cw, yf / ch)
        return None
    if calib is None or len(calib.homography) != 9:
        return None
    xp, yp = t.get("x_pixel"), t.get("y_pixel")
    if xp is None or yp is None:
        return None
    xm, ym = pixel_to_court(float(xp), float(yp), calib)
    cw_u = float(calib.court_width_m or cw)
    ch_u = float(calib.court_height_m or ch)
    if cw_u > 1e-9 and ch_u > 1e-9:
        return (xm / cw_u, ym / ch_u)
    return None


def _zone_label(x: Optional[float], y: Optional[float]) -> str:
    if x is None or y is None:
        return "-"
    zi = _zone_index(float(x), float(y))
    return _ZONE_NAMES[zi]


def _court_norm_to_m(xn: float, yn: float) -> Tuple[float, float]:
    return (float(xn) * COURT_WIDTH_M, float(yn) * COURT_HEIGHT_M)


def _project_court_polygon_to_image(poly_norm: List[Tuple[float, float]], h_court_to_img: np.ndarray) -> Optional[np.ndarray]:
    """
    Project normalized court-space polygon to image pixels using inverse homography.
    Returns an int32 contour suitable for cv2.fillPoly / cv2.polylines.
    """
    if h_court_to_img.shape != (3, 3):
        return None
    pts_m = np.array([_court_norm_to_m(xn, yn) for (xn, yn) in poly_norm], dtype=np.float32).reshape(-1, 1, 2)
    try:
        pts_img = cv2.perspectiveTransform(pts_m, h_court_to_img)
    except cv2.error:
        return None
    return np.round(pts_img.reshape(-1, 2)).astype(np.int32)


def _blend_convex_poly_bgr(
    frame: np.ndarray,
    poly_xy: np.ndarray,
    color: Tuple[int, int, int],
    alpha: float,
) -> None:
    """Semi-transparent fill of a convex quadrilateral (BGR)."""
    h, w = frame.shape[:2]
    mask = np.zeros((h, w), dtype=np.uint8)
    cv2.fillConvexPoly(mask, poly_xy, 255)
    m = mask > 0
    if not np.any(m):
        return
    b, g, r = float(color[0]), float(color[1]), float(color[2])
    fb = frame[:, :, 0].astype(np.float32)
    fg = frame[:, :, 1].astype(np.float32)
    fr = frame[:, :, 2].astype(np.float32)
    fb[m] = (1.0 - alpha) * fb[m] + alpha * b
    fg[m] = (1.0 - alpha) * fg[m] + alpha * g
    fr[m] = (1.0 - alpha) * fr[m] + alpha * r
    frame[:, :, 0] = np.clip(fb, 0, 255).astype(np.uint8)
    frame[:, :, 1] = np.clip(fg, 0, 255).astype(np.uint8)
    frame[:, :, 2] = np.clip(fr, 0, 255).astype(np.uint8)


def _draw_net_floor_band_tint(out: np.ndarray, h_court_to_img: np.ndarray) -> None:
    """Semi-transparent yellow floor strip at mid-court (model net line); not the vertical net mesh."""
    dy = NET_BAND_HALF_WIDTH_NORM
    poly_norm = [
        (0.0, 0.5 - dy),
        (1.0, 0.5 - dy),
        (1.0, 0.5 + dy),
        (0.0, 0.5 + dy),
    ]
    contour = _project_court_polygon_to_image(poly_norm, h_court_to_img)
    if contour is None or len(contour) < 3:
        return
    _blend_convex_poly_bgr(out, contour.reshape(-1, 2), NET_TINT_BGR, NET_TINT_ALPHA)
    pt = _norm_xy_to_pixel(0.5, 0.5, h_court_to_img)
    if pt is None:
        return
    xi, yi = pt
    h_img, w_img = out.shape[:2]
    lab = "net"
    fs = NET_LABEL_FS * 0.95
    (tw, th), _ = cv2.getTextSize(lab, cv2.FONT_HERSHEY_SIMPLEX, fs, 1)
    ox = int(xi - tw / 2)
    oy = int(yi + th / 2)
    ox = max(2, min(w_img - tw - 2, ox))
    oy = max(th + 2, min(h_img - 2, oy))
    _put_text_shadow(out, lab, (ox, oy), fs, NET_LABEL_BGR)


def _draw_net_floor_manual_tint(out: np.ndarray, quad_px: np.ndarray) -> None:
    """Semi-transparent red fill from saved net-floor quad (image pixels, 4 corners)."""
    if quad_px is None or len(quad_px) < 3:
        return
    q = np.asarray(quad_px, dtype=np.int32).reshape(-1, 2)
    _blend_convex_poly_bgr(out, q, NET_MANUAL_TINT_BGR, NET_MANUAL_TINT_ALPHA)


def _draw_projected_court_overlay(
    out: np.ndarray,
    h_img_to_court: Optional[np.ndarray],
    net_floor_quad_px: Optional[np.ndarray] = None,
) -> None:
    """
    Floor overlay: optional manual net quad (red, from calibrate-net-floor), else homography
    net strip (yellow). Court lines and zone labels need homography. (Wall glass deferred.)
    """
    h_court_to_img: Optional[np.ndarray] = None
    if h_img_to_court is not None:
        try:
            h_court_to_img = np.linalg.inv(h_img_to_court)
        except np.linalg.LinAlgError:
            h_court_to_img = None

    if net_floor_quad_px is not None and len(net_floor_quad_px) >= 3:
        _draw_net_floor_manual_tint(out, net_floor_quad_px)
    elif h_court_to_img is not None:
        _draw_net_floor_band_tint(out, h_court_to_img)

    if h_court_to_img is None:
        return

    # Court lines: outer, net, service lines, center service line.
    line_polys = [
        [(0.0, 0.0), (1.0, 0.0), (1.0, 1.0), (0.0, 1.0)],
    ]
    for poly in line_polys:
        contour = _project_court_polygon_to_image(poly, h_court_to_img)
        if contour is not None:
            cv2.polylines(out, [contour], True, (230, 230, 230), 2, cv2.LINE_AA)

    for y in (0.5, SERVICE_LINE_NORM, 1.0 - SERVICE_LINE_NORM):
        contour = _project_court_polygon_to_image([(0.0, y), (1.0, y)], h_court_to_img)
        if contour is not None and len(contour) >= 2:
            p0 = tuple(contour[0])
            p1 = tuple(contour[1])
            cv2.line(out, p0, p1, (220, 220, 220), 2, cv2.LINE_AA)
    center = _project_court_polygon_to_image(
        [(0.5, SERVICE_LINE_NORM), (0.5, 1.0 - SERVICE_LINE_NORM)],
        h_court_to_img,
    )
    if center is not None and len(center) >= 2:
        cv2.line(out, tuple(center[0]), tuple(center[1]), (220, 220, 220), 2, cv2.LINE_AA)

    _draw_floor_zone_labels(out, h_court_to_img)


def _project_court_meters_to_image(pts_m: np.ndarray, h_court_to_img: np.ndarray) -> Optional[np.ndarray]:
    """pts_m: (N, 2) court coordinates in meters. Returns (N, 2) pixel float."""
    if h_court_to_img.shape != (3, 3) or pts_m.size == 0:
        return None
    p = pts_m.astype(np.float32).reshape(-1, 1, 2)
    try:
        return cv2.perspectiveTransform(p, h_court_to_img).reshape(-1, 2)
    except cv2.error:
        return None


def _norm_xy_to_pixel(xn: float, yn: float, h_court_to_img: np.ndarray) -> Optional[Tuple[int, int]]:
    xm, ym = _court_norm_to_m(float(xn), float(yn))
    pts = np.array([[xm, ym]], dtype=np.float32)
    pix = _project_court_meters_to_image(pts, h_court_to_img)
    if pix is None:
        return None
    return (int(round(float(pix[0, 0]))), int(round(float(pix[0, 1]))))


def _draw_floor_zone_labels(out: np.ndarray, h_court_to_img: np.ndarray) -> None:
    """
    Six labels: **three** per team half (full width at x=0.5) — back/mid/net on side A and side B.
    """
    h_img, w_img = out.shape[:2]
    sl = SERVICE_LINE_NORM
    zn = _ZONE_NAMES
    cx = 0.5
    # Half A (toward baseline 0): back → mid → net; half B (toward baseline 1): net → mid → back.
    specs: List[Tuple[float, float, str]] = [
        (cx, sl / 2.0, zn[0]),
        (cx, (sl + NET_Y_LOW) / 2.0, zn[1]),
        (cx, (NET_Y_LOW + 0.5) / 2.0, zn[2]),
        (cx, (0.5 + NET_Y_HI) / 2.0, zn[5]),
        (cx, (NET_Y_HI + (1.0 - sl)) / 2.0, zn[4]),
        (cx, 1.0 - sl / 2.0, zn[3]),
    ]
    fs = 0.28
    tc = (195, 205, 215)
    for xn, yn, label in specs:
        pt = _norm_xy_to_pixel(xn, yn, h_court_to_img)
        if pt is None:
            continue
        xi, yi = pt
        if not (-40 <= xi < w_img + 40 and -40 <= yi < h_img + 40):
            continue
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, fs, 1)
        ox = int(xi - tw / 2)
        oy = int(yi + th / 2)
        ox = max(4, min(w_img - tw - 4, ox))
        oy = max(th + 4, min(h_img - 4, oy))
        _put_text_shadow(out, label, (ox, oy), fs, tc)


def _put_text_shadow(
    img: np.ndarray,
    text: str,
    org: Tuple[int, int],
    font_scale: float,
    color: Tuple[int, int, int] = (255, 255, 255),
) -> None:
    x, y = org
    for dx, dy in ((1, 1), (1, -1), (-1, 1), (-1, -1), (2, 0), (-2, 0), (0, 2), (0, -2)):
        cv2.putText(
            img,
            text,
            (x + dx, y + dy),
            cv2.FONT_HERSHEY_SIMPLEX,
            font_scale,
            (0, 0, 0),
            2,
            cv2.LINE_AA,
        )
    cv2.putText(img, text, (x, y), cv2.FONT_HERSHEY_SIMPLEX, font_scale, color, 1, cv2.LINE_AA)


def _load_calibration_points_json(match_dir: Path) -> Optional[Dict[str, Any]]:
    """Load calibration_points.json from match calibration dir (saved clicks + labels)."""
    for p in (match_dir / "calibration" / "calibration_points.json",):
        if p.exists():
            try:
                data = read_json(p)
                if isinstance(data, dict) and data.get("points_px"):
                    return data
            except Exception:
                pass
    # Fallback: court artifact (e.g. match dir copied before we added points file)
    try:
        meta = read_json(match_dir / "meta" / "meta.json")
        cid = meta.get("court_id") if isinstance(meta, dict) else None
        if cid:
            from src.pipeline.paths import court_calibration_dir

            cp = court_calibration_dir(str(cid)) / "calibration_points.json"
            if cp.exists():
                data = read_json(cp)
                if isinstance(data, dict) and data.get("points_px"):
                    return data
    except Exception:
        pass
    return None


def _draw_user_calibration_clicks(
    out: np.ndarray,
    points_px: List[List[float]],
    labels: Optional[List[str]],
) -> None:
    """
    Draw exact pixel positions the operator clicked during calibrate-court (from JSON).
    Lime = your clicks — compare to court lines, not the frame border.
    """
    h_img, w_img = out.shape[:2]
    n = len(points_px)
    for i in range(n):
        x, y = float(points_px[i][0]), float(points_px[i][1])
        xi, yi = int(round(x)), int(round(y))
        if not (0 <= xi < w_img and 0 <= yi < h_img):
            continue
        cv2.drawMarker(
            out,
            (xi, yi),
            (0, 255, 100),
            markerType=cv2.MARKER_CROSS,
            markerSize=22,
            thickness=2,
        )
        cv2.circle(out, (xi, yi), 14, (0, 255, 100), 2)
        short = f"{i + 1}"
        if labels and i < len(labels):
            lab = labels[i]
            if ". " in lab:
                lab = lab.split(". ", 1)[1]
            short = f"{i + 1}: {lab[:28]}"
        _put_text_shadow(out, short, (min(xi + 12, w_img - 200), max(yi - 8, 16)), 0.42, (180, 255, 180))


def _draw_calibration_reference_points(
    out: np.ndarray,
    h_img_to_court: Optional[np.ndarray],
    num_points: Optional[int],
    court_width_m: float,
    court_height_m: float,
) -> None:
    """
    Draw where each calibration model corner projects into the image (inverse H).
    num_points 4 or 12; if None (legacy JSON), show 4 corners only.
    Skipped when user saved clicks are shown (use JSON markers instead).
    """
    if h_img_to_court is None:
        return
    n = num_points if num_points in (4, 12) else 4
    try:
        h_court_to_img = np.linalg.inv(h_img_to_court)
    except np.linalg.LinAlgError:
        return
    dst_m = get_court_dst(n, court_width_m, court_height_m)
    pix = _project_court_meters_to_image(dst_m, h_court_to_img)
    if pix is None:
        return
    shorts = get_court_overlay_short_labels(n)
    fulls = get_court_labels(n)
    h_img, w_img = out.shape[:2]
    for i in range(len(pix)):
        x, y = float(pix[i, 0]), float(pix[i, 1])
        xi, yi = int(round(x)), int(round(y))
        if not (-80 <= xi < w_img + 80 and -80 <= yi < h_img + 80):
            continue
        cv2.circle(out, (xi, yi), 12, (0, 255, 255), 2)
        cv2.circle(out, (xi, yi), 4, (0, 0, 0), -1)
        name = fulls[i]
        if ". " in name:
            name = name.split(". ", 1)[1]
        if len(name) > 44:
            name = name[:41] + "..."
        tx, ty = xi + 14, yi - 8
        if tx + 320 > w_img:
            tx = max(8, xi - 200)
        if ty < 18:
            ty = yi + 22
        _put_text_shadow(out, shorts[i], (tx, ty), 0.5, (0, 255, 255))
        _put_text_shadow(out, name, (tx, ty + 18), 0.38, (235, 245, 255))


def _segment_m(p0: Tuple[float, float], p1: Tuple[float, float]) -> float:
    dx = (p1[0] - p0[0]) * COURT_WIDTH_M
    dy = (p1[1] - p0[1]) * COURT_HEIGHT_M
    return float((dx * dx + dy * dy) ** 0.5)


class HudStatsCache:
    """Per-player running distance and last-segment velocity up to each frame."""

    def __init__(
        self,
        tracks_canonical: List[dict],
        fps: float,
        *,
        calib: Optional[CalibrationHomography] = None,
        court_width_m: float = COURT_WIDTH_M,
        court_height_m: float = COURT_HEIGHT_M,
    ):
        self.fps = fps if fps and fps > 0 else 30.0
        self.calib = calib
        self.cw = float(court_width_m)
        self.ch = float(court_height_m)
        self.by_player: Dict[int, List[dict]] = {1: [], 2: [], 3: [], 4: []}
        for t in tracks_canonical:
            pid = t.get("player_id")
            if pid is None:
                continue
            try:
                pid = int(pid)
            except (TypeError, ValueError):
                continue
            if pid not in self.by_player:
                continue
            if _norm_court_xy_from_track(t, calib, self.cw, self.ch) is None:
                continue
            self.by_player[pid].append(t)
        for pid in self.by_player:
            self.by_player[pid].sort(key=lambda x: int(x.get("frame", 0)))

    def stats_up_to(self, frame_idx: int) -> Dict[int, Dict[str, Any]]:
        out: Dict[int, Dict[str, Any]] = {}
        for pid in (1, 2, 3, 4):
            lst = [t for t in self.by_player[pid] if int(t.get("frame", 0)) <= frame_idx]
            if not lst:
                out[pid] = {
                    "dist_m": 0.0,
                    "vx_kmh": 0.0,
                    "vy_kmh": 0.0,
                    "v_kmh": 0.0,
                    "x": None,
                    "y": None,
                    "zone": "-",
                }
                continue
            dist = 0.0
            for i in range(1, len(lst)):
                p0 = _norm_court_xy_from_track(lst[i - 1], self.calib, self.cw, self.ch)
                p1 = _norm_court_xy_from_track(lst[i], self.calib, self.cw, self.ch)
                if p0 and p1:
                    dist += _segment_m(p0, p1)
            last = lst[-1]
            pt = _norm_court_xy_from_track(last, self.calib, self.cw, self.ch)
            x, y = (pt[0], pt[1]) if pt else (None, None)
            vx_kmh = vy_kmh = v_kmh = 0.0
            if len(lst) >= 2:
                a, b = lst[-2], lst[-1]
                p0 = _norm_court_xy_from_track(a, self.calib, self.cw, self.ch)
                p1 = _norm_court_xy_from_track(b, self.calib, self.cw, self.ch)
                if p0 and p1:
                    fr0 = int(a.get("frame", 0))
                    fr1 = int(b.get("frame", 0))
                    ts0 = a.get("timestamp")
                    ts1 = b.get("timestamp")
                    if ts0 is not None and ts1 is not None and float(ts1) > float(ts0):
                        dt = float(ts1) - float(ts0)
                    else:
                        dt = (fr1 - fr0) / self.fps if self.fps > 0 else 0.0
                    if dt > 0:
                        vx_m_s = (p1[0] - p0[0]) * COURT_WIDTH_M / dt
                        vy_m_s = (p1[1] - p0[1]) * COURT_HEIGHT_M / dt
                        vx_kmh = vx_m_s * 3.6
                        vy_kmh = vy_m_s * 3.6
                        v_kmh = (vx_m_s * vx_m_s + vy_m_s * vy_m_s) ** 0.5 * 3.6
            out[pid] = {
                "dist_m": dist,
                "vx_kmh": vx_kmh,
                "vy_kmh": vy_kmh,
                "v_kmh": v_kmh,
                "x": x,
                "y": y,
                "zone": _zone_label(x, y),
            }
        return out


def _blend_rect(
    frame: np.ndarray,
    x: int,
    y: int,
    w: int,
    h: int,
    color: Tuple[int, int, int] = (0, 0, 0),
    alpha: float = 0.55,
) -> None:
    roi = frame[y : y + h, x : x + w]
    if roi.size == 0:
        return
    solid = np.full_like(roi, color, dtype=np.uint8)
    blended = cv2.addWeighted(roi, 1.0 - alpha, solid, alpha, 0)
    frame[y : y + h, x : x + w] = blended


def _blend_patch_xyxy(
    frame: np.ndarray,
    x1: int,
    y1: int,
    x2: int,
    y2: int,
    color: Tuple[int, int, int],
    alpha: float,
) -> None:
    """Clip to frame; blend solid BGR patch (x1,y1) to (x2,y2) exclusive bottom-right for slicing."""
    h_img, w_img = frame.shape[:2]
    xa, xb = max(0, min(w_img, x1)), max(0, min(w_img, x2))
    ya, yb = max(0, min(h_img, y1)), max(0, min(h_img, y2))
    if xb <= xa or yb <= ya:
        return
    roi = frame[ya:yb, xa:xb]
    if roi.size == 0:
        return
    solid = np.full_like(roi, color, dtype=np.uint8)
    blended = cv2.addWeighted(roi, 1.0 - alpha, solid, alpha, 0)
    frame[ya:yb, xa:xb] = blended


def _draw_hud(
    out: np.ndarray,
    *,
    frame_idx: int,
    time_s: float,
    stats: Dict[int, Dict[str, Any]],
    flags: Dict[str, bool],
) -> None:
    pad_x, pad_y = 12, 12
    panel_w, panel_h = 500, 200
    _blend_rect(out, pad_x, pad_y, panel_w, panel_h)

    fs = 0.45
    fc = (255, 255, 255)
    line = 18
    y0 = pad_y + 14
    cv2.putText(
        out,
        f"Frame {frame_idx}  Time {time_s:.2f}s",
        (pad_x + 8, y0),
        cv2.FONT_HERSHEY_SIMPLEX,
        fs + 0.1,
        fc,
        1,
        cv2.LINE_AA,
    )
    y0 += line
    rally = "true" if flags.get("rally") else "false"
    ball = "true" if flags.get("ball") else "false"
    stroke = "true" if flags.get("stroke") else "false"
    pose = "true" if flags.get("pose") else "false"
    cv2.putText(
        out,
        f"Rally: {rally}  Ball: {ball}  Stroke: {stroke}  Pose: {pose}",
        (pad_x + 8, y0),
        cv2.FONT_HERSHEY_SIMPLEX,
        fs,
        (200, 200, 200),
        1,
        cv2.LINE_AA,
    )
    y0 += line + 2
    hdr = "        Dist(m)  Vx   Vy   V(km/h)  Zone"
    cv2.putText(out, hdr, (pad_x + 8, y0), cv2.FONT_HERSHEY_SIMPLEX, fs, (180, 220, 255), 1, cv2.LINE_AA)
    y0 += line
    for pid in (1, 2, 3, 4):
        s = stats.get(pid, {})
        dist = s.get("dist_m", 0.0)
        vx = s.get("vx_kmh", 0.0)
        vy = s.get("vy_kmh", 0.0)
        v = s.get("v_kmh", 0.0)
        z = s.get("zone", "-")
        txt = f"P{pid}     {dist:5.1f}  {vx:4.1f} {vy:4.1f} {v:5.1f}  {z}"
        cv2.putText(
            out,
            txt,
            (pad_x + 8, y0),
            cv2.FONT_HERSHEY_SIMPLEX,
            fs,
            fc,
            1,
            cv2.LINE_AA,
        )
        y0 += line


def _draw_minimap(
    out: np.ndarray,
    stats: Dict[int, Dict[str, Any]],
    *,
    heatmap_bgr: Optional[np.ndarray] = None,
    court_height_m: float = COURT_HEIGHT_M,
    margin_right: int = 16,
    margin_top: int = 16,
    map_w: int = 200,
    map_h: int = 400,
) -> None:
    """
    Right panel: normalized court map — zone fills by depth (back / mid / net, same color each),
    optional heat blend, then team-colored dots (P1–P2 vs P3–P4) with P# labels that follow position.
    """
    h_img, w_img = out.shape[:2]
    x0 = w_img - map_w - margin_right
    y0 = margin_top
    _blend_rect(out, x0, y0, map_w, map_h, color=(20, 20, 30), alpha=0.5)
    border = 8
    inner_w = map_w - 2 * border
    inner_h = map_h - 2 * border
    ix0, iy0 = x0 + border, y0 + border

    cv2.putText(
        out,
        "Live court (zones)",
        (ix0 + 4, iy0 + 14),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.38,
        (160, 175, 200),
        1,
        cv2.LINE_AA,
    )
    iy_heat = iy0 + 22
    heat_h = max(48, inner_h - 22)

    def y_px(yn: float) -> int:
        return iy_heat + int(float(yn) * float(heat_h))

    ch = float(court_height_m)
    if ch > 1e-6:
        sl = SERVICE_LINE_FROM_BASELINE_M / ch
        nl = 0.5 - NET_ATTACK_DEPTH_M / ch
        nh = 0.5 + NET_ATTACK_DEPTH_M / ch
    else:
        sl = SERVICE_LINE_NORM
        nl = NET_Y_LOW
        nh = NET_Y_HI
    sr = 1.0 - sl
    y_top = y_px(0.0)
    y_sl = y_px(sl)
    y_nl = y_px(nl)
    y_net = y_px(0.5)
    y_nh = y_px(nh)
    y_sr = y_px(sr)
    y_bot = y_px(1.0)

    # Base fill for map area
    cv2.rectangle(out, (ix0, iy_heat), (ix0 + inner_w, iy_heat + heat_h), (38, 40, 52), -1)

    cx = ix0 + inner_w // 2
    ta = MINIMAP_TINT_ALPHA
    # Team A: back (full), mid (L/R), net strip to center
    _blend_patch_xyxy(out, ix0, y_top, ix0 + inner_w, y_sl, MINIMAP_TINT_BACK, ta)
    _blend_patch_xyxy(out, ix0, y_sl, cx, y_nl, MINIMAP_TINT_MID, ta)
    _blend_patch_xyxy(out, cx, y_sl, ix0 + inner_w, y_nl, MINIMAP_TINT_MID, ta)
    _blend_patch_xyxy(out, ix0, y_nl, ix0 + inner_w, y_net, MINIMAP_TINT_NET, ta)
    # Team B: net strip from center, mid (L/R), back (full)
    _blend_patch_xyxy(out, ix0, y_net, ix0 + inner_w, y_nh, MINIMAP_TINT_NET, ta)
    _blend_patch_xyxy(out, ix0, y_nh, cx, y_sr, MINIMAP_TINT_MID, ta)
    _blend_patch_xyxy(out, cx, y_nh, ix0 + inner_w, y_sr, MINIMAP_TINT_MID, ta)
    _blend_patch_xyxy(out, ix0, y_sr, ix0 + inner_w, y_bot, MINIMAP_TINT_BACK, ta)

    roi_slice = out[iy_heat : iy_heat + heat_h, ix0 : ix0 + inner_w]
    if heatmap_bgr is not None and inner_w > 0 and heat_h > 0 and roi_slice.size > 0:
        hm = heatmap_bgr
        if hm.ndim == 2:
            hm = cv2.cvtColor(hm, cv2.COLOR_GRAY2BGR)
        hm = cv2.resize(hm, (inner_w, heat_h), interpolation=cv2.INTER_AREA)
        if hm.shape[:2] == roi_slice.shape[:2]:
            cv2.addWeighted(hm, 0.32, roi_slice, 0.68, 0, dst=roi_slice)
        else:
            pass
    cv2.rectangle(out, (ix0, iy_heat), (ix0 + inner_w, iy_heat + heat_h), (120, 120, 140), 1)

    # Court lines (on top of heat + tints)
    cv2.line(out, (ix0, y_net), (ix0 + inner_w, y_net), (90, 220, 130), 2, cv2.LINE_AA)
    cv2.line(out, (ix0, y_sl), (ix0 + inner_w, y_sl), (95, 100, 118), 1, cv2.LINE_AA)
    cv2.line(out, (ix0, y_sr), (ix0 + inner_w, y_sr), (95, 100, 118), 1, cv2.LINE_AA)
    cv2.line(out, (ix0, y_nl), (ix0 + inner_w, y_nl), (82, 88, 105), 1, cv2.LINE_AA)
    cv2.line(out, (ix0, y_nh), (ix0 + inner_w, y_nh), (82, 88, 105), 1, cv2.LINE_AA)
    cv2.line(out, (cx, y_sl), (cx, y_sr), (88, 92, 108), 1, cv2.LINE_AA)

    # Zone abbreviations (centroids; mid split L/R for visibility)
    label_centers: List[Tuple[int, int, str]] = [
        (ix0 + inner_w // 2, (y_top + y_sl) // 2, MINIMAP_ZONE_LABELS[0]),
        (ix0 + inner_w // 4, (y_sl + y_nl) // 2, MINIMAP_ZONE_LABELS[1]),
        (ix0 + (3 * inner_w) // 4, (y_sl + y_nl) // 2, MINIMAP_ZONE_LABELS[2]),
        (ix0 + inner_w // 2, (y_nl + y_net) // 2, MINIMAP_ZONE_LABELS[3]),
        (ix0 + inner_w // 2, (y_net + y_nh) // 2, MINIMAP_ZONE_LABELS[4]),
        (ix0 + inner_w // 4, (y_nh + y_sr) // 2, MINIMAP_ZONE_LABELS[5]),
        (ix0 + (3 * inner_w) // 4, (y_nh + y_sr) // 2, MINIMAP_ZONE_LABELS[6]),
        (ix0 + inner_w // 2, (y_sr + y_bot) // 2, MINIMAP_ZONE_LABELS[7]),
    ]
    fs_lab = MINIMAP_LABEL_FS
    for lx, ly, lab in label_centers:
        if ly <= y_top + 2 or ly >= y_bot - 2:
            continue
        (tw, th), _ = cv2.getTextSize(lab, cv2.FONT_HERSHEY_SIMPLEX, fs_lab, 1)
        ox = int(lx - tw / 2)
        oy = int(ly + th / 2)
        ox = max(ix0 + 2, min(ix0 + inner_w - tw - 2, ox))
        oy = max(iy_heat + th + 2, min(iy_heat + heat_h - 2, oy))
        _put_text_shadow(out, lab, (ox, oy), fs_lab, MINIMAP_LABEL_COLOR)

    dot_positions: List[Tuple[int, int, int, Tuple[int, int, int]]] = []
    for pid in (1, 2, 3, 4):
        s = stats.get(pid, {})
        xc, yy = s.get("x"), s.get("y")
        if xc is None or yy is None:
            continue
        mx = ix0 + int(float(xc) * inner_w)
        my = iy_heat + int(float(yy) * heat_h)
        col = _minimap_player_bgr(pid)
        cv2.circle(out, (mx, my), MINIMAP_DOT_RADIUS, col, -1, cv2.LINE_AA)
        cv2.circle(out, (mx, my), MINIMAP_DOT_RADIUS + 1, (25, 25, 32), 1, cv2.LINE_AA)
        dot_positions.append((pid, mx, my, col))
    for pid, mx, my, col in dot_positions:
        lab = f"P{pid}"
        fs_id = MINIMAP_ID_FS
        (tw, th), _ = cv2.getTextSize(lab, cv2.FONT_HERSHEY_SIMPLEX, fs_id, 1)
        ox = int(mx - tw / 2)
        oy = int(my - MINIMAP_DOT_RADIUS - 4)
        ox = max(ix0 + 1, min(ix0 + inner_w - tw - 1, ox))
        oy = max(iy_heat + th + 1, min(iy_heat + heat_h - 2, oy))
        _put_text_shadow(out, lab, (ox, oy), fs_id, col)

    cv2.putText(
        out,
        "Tracks - normalized court",
        (x0 + 4, y0 + map_h - 8),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.38,
        (160, 160, 160),
        1,
        cv2.LINE_AA,
    )


def render_analytics_frame(
    frame_bgr: np.ndarray,
    tracks_for_frame: List[dict],
    *,
    hud_stats: Dict[int, Dict[str, Any]],
    overlay_flags: Dict[str, bool],
    frame_idx: int,
    fps: float,
    h_img_to_court: Optional[np.ndarray] = None,
    num_calibration_points: Optional[int] = None,
    court_width_m: float = COURT_WIDTH_M,
    court_height_m: float = COURT_HEIGHT_M,
    heatmap_bgr: Optional[np.ndarray] = None,
    user_clicks_px: Optional[List[List[float]]] = None,
    user_click_labels: Optional[List[str]] = None,
    net_floor_quad_px: Optional[np.ndarray] = None,
    bbox_color: Tuple[int, int, int] = (255, 120, 0),
) -> np.ndarray:
    """Court tint/lines, tracks, saved clicks OR projected ref, HUD, right panel: live minimap."""
    time_s = frame_idx / fps if fps > 0 else 0.0
    out = frame_bgr.copy()
    _draw_projected_court_overlay(out, h_img_to_court, net_floor_quad_px)
    out = draw_tracks_on_frame(
        out,
        tracks_for_frame,
        color=bbox_color,
        thickness=2,
        font_scale=0.55,
    )
    if user_clicks_px is not None and len(user_clicks_px) >= 4:
        _draw_user_calibration_clicks(out, user_clicks_px, user_click_labels)
    else:
        _draw_calibration_reference_points(
            out,
            h_img_to_court,
            num_calibration_points,
            court_width_m,
            court_height_m,
        )
    _draw_hud(out, frame_idx=frame_idx, time_s=time_s, stats=hud_stats, flags=overlay_flags)
    _draw_minimap(
        out,
        hud_stats,
        heatmap_bgr=heatmap_bgr,
        court_height_m=court_height_m,
    )
    return out


def _optional_ball_flags(match_dir: Path) -> Tuple[bool, bool]:
    """Return (ball_visible, rally_active) from optional artifacts; false if missing or invalid."""
    ball_path = match_dir / "tracks" / "ball.json"
    rally_path = match_dir / "tracks" / "rally.json"
    ball = False
    rally = False
    if ball_path.exists():
        try:
            data = read_json(ball_path)
            if isinstance(data, list) and len(data) > 0:
                ball = True
            elif isinstance(data, dict):
                ball = bool(
                    data.get("positions")
                    or data.get("frames")
                    or data.get("detections")
                )
        except Exception:
            pass
    if rally_path.exists():
        try:
            r = read_json(rally_path)
            if isinstance(r, dict):
                rally = bool(r.get("active") or r.get("rally_active"))
            elif isinstance(r, list) and r:
                rally = True
        except Exception:
            pass
    return ball, rally


def write_analytics_overlay_video(
    match_dir: Path,
    video_path: Path,
    *,
    tracks_raw: List[dict],
    tracks_canonical: List[dict],
    fps: float,
    out_name: str = "analytics_overlay.mp4",
    max_seconds: float = DEFAULT_MAX_OVERLAY_SECONDS,
    start_frame: Optional[int] = None,
    max_frames: Optional[int] = None,
) -> Optional[Path]:
    """
    Encode analytics-style overlay to renders/{out_name}.
    Ball / rally / stroke are false unless optional JSON exists (ball partial, rally from events).
    If start_frame / max_frames are None, uses first tracked frame and caps length by max_seconds.
    """
    renders_dir = match_dir / "renders"
    renders_dir.mkdir(parents=True, exist_ok=True)
    out_video = renders_dir / out_name

    if not video_path.exists():
        return None

    by_frame_raw = group_tracks_by_frame(tracks_raw)
    ball_flag, rally_flag = _optional_ball_flags(match_dir)
    h_img_to_court: Optional[np.ndarray] = None
    num_calibration_points: Optional[int] = None
    cw_m, ch_m = float(COURT_WIDTH_M), float(COURT_HEIGHT_M)
    calib = load_homography(match_dir / "calibration" / "homography.json")
    if calib:
        num_calibration_points = calib.num_points
        if calib.court_width_m is not None:
            cw_m = float(calib.court_width_m)
        if calib.court_height_m is not None:
            ch_m = float(calib.court_height_m)
        if isinstance(calib.homography, list) and len(calib.homography) == 9:
            try:
                h_img_to_court = np.array(calib.homography, dtype=np.float32).reshape(3, 3)
            except Exception:
                h_img_to_court = None

    heatmap_bgr: Optional[np.ndarray] = None
    hm_path = match_dir / "reports" / "heatmap.png"
    if hm_path.exists():
        hm = cv2.imread(str(hm_path))
        if hm is not None and hm.size > 0:
            heatmap_bgr = hm

    calib_points_data = _load_calibration_points_json(match_dir)
    user_clicks_px: Optional[List[List[float]]] = None
    user_click_labels: Optional[List[str]] = None
    if calib_points_data:
        user_clicks_px = calib_points_data.get("points_px")
        user_click_labels = calib_points_data.get("labels")
        if not isinstance(user_clicks_px, list):
            user_clicks_px = None

    cap = cv2.VideoCapture(str(video_path))
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    fps_v = cap.get(cv2.CAP_PROP_FPS) or fps or 30.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    cap.release()

    net_floor_quad_px = load_net_floor_quad_pixels(match_dir, w, h)

    # HudStatsCache needs calib + dimensions; use video fps for speed stats
    cache = HudStatsCache(
        tracks_canonical,
        fps_v,
        calib=calib,
        court_width_m=cw_m,
        court_height_m=ch_m,
    )

    frame_indices = sorted(by_frame_raw.keys()) if by_frame_raw else []
    sf = start_frame if start_frame is not None else (frame_indices[0] if frame_indices else 0)
    if max_frames is not None:
        n_encode = max(0, min(max_frames, n_frames - sf))
    else:
        n_encode = n_frames - sf
        if max_seconds and max_seconds > 0:
            cap_sec = int(max_seconds * fps_v)
            n_encode = min(n_encode, cap_sec)

    if n_encode <= 0:
        return None

    cap = cv2.VideoCapture(str(video_path))
    cap.set(cv2.CAP_PROP_POS_FRAMES, sf)

    writer = cv2.VideoWriter(
        str(out_video),
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps_v,
        (w, h),
    )

    had_pose_any = any(t.get("keypoints") for t in tracks_raw)
    for i in range(n_encode):
        ret, frame = cap.read()
        if not ret or frame is None:
            break
        frame_idx = sf + i
        tr = by_frame_raw.get(frame_idx, [])
        hud = cache.stats_up_to(frame_idx)
        flags = {
            "rally": rally_flag,
            "ball": ball_flag,
            "stroke": False,
            "pose": any(t.get("keypoints") for t in tr),
        }
        out = render_analytics_frame(
            frame,
            tr,
            hud_stats=hud,
            overlay_flags=flags,
            frame_idx=frame_idx,
            fps=fps_v,
            h_img_to_court=h_img_to_court,
            num_calibration_points=num_calibration_points,
            court_width_m=cw_m,
            court_height_m=ch_m,
            heatmap_bgr=heatmap_bgr,
            user_clicks_px=user_clicks_px,
            user_click_labels=user_click_labels,
            net_floor_quad_px=net_floor_quad_px,
        )
        writer.write(out)

    writer.release()
    cap.release()

    write_json_atomic(
        renders_dir / "overlay_meta.json",
        {
            "video": str(out_video.name),
            "ball_detected": ball_flag,
            "rally_active": rally_flag,
            "stroke_classification": False,
            "pose_skeleton": had_pose_any,
            "frames_encoded": n_encode,
            "start_frame": sf,
            "fps": fps_v,
            "calibration_num_points": num_calibration_points,
            "heatmap_panel": bool(heatmap_bgr is not None),
            "calibration_clicks_overlay": bool(user_clicks_px is not None and len(user_clicks_px) >= 4),
            "net_floor_quad_manual": bool(net_floor_quad_px is not None and len(net_floor_quad_px) >= 3),
        },
    )

    return out_video
