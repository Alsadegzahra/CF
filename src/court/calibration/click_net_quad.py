"""
Interactive 4-click net-floor quad (same window style as click_calibrate).
"""
from __future__ import annotations

from pathlib import Path
from typing import List, Tuple

import cv2
import numpy as np

from src.court.calibration.net_floor_quad import NET_FLOOR_QUAD_LABELS


def _load_frame(path: Path) -> Tuple:
    """Load image or first video frame; return (BGR, width, height)."""
    path = Path(path)
    suf = path.suffix.lower()
    if suf in (".mp4", ".mov", ".avi", ".mkv"):
        cap = cv2.VideoCapture(str(path))
        ok, frame = cap.read()
        cap.release()
        if not ok or frame is None:
            raise RuntimeError(f"Could not read first frame: {path}")
    else:
        frame = cv2.imread(str(path))
        if frame is None:
            raise RuntimeError(f"Could not read image: {path}")
    h, w = frame.shape[:2]
    return frame, w, h


def calibrate_net_floor_quad_from_clicks(
    image_or_video_path: Path,
) -> Tuple[np.ndarray, List[Tuple[int, int]], int, int]:
    """
    Show first frame; user clicks 4 corners around the net band on the floor (clockwise).
    Returns (reference_frame_bgr, points_px, width, height).
    """
    img, w, h = _load_frame(Path(image_or_video_path))
    num_points = 4
    labels = NET_FLOOR_QUAD_LABELS
    points: List[Tuple[int, int]] = []
    title = "Net floor: click 4 corners (clockwise around net band)"
    display = img.copy()

    def draw_scene(d, current_label_idx: int) -> None:
        for j, pt in enumerate(points):
            cv2.circle(d, pt, 8, (0, 200, 255), 2)
            cv2.putText(d, str(j + 1), (pt[0] + 10, pt[1]), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (200, 240, 255), 1)
        if len(points) >= 2:
            for k in range(len(points) - 1):
                cv2.line(d, points[k], points[k + 1], (0, 200, 255), 2)
        if len(points) == 4:
            cv2.line(d, points[3], points[0], (0, 200, 255), 2)
        active = labels[current_label_idx] if current_label_idx < num_points else labels[-1]
        cv2.putText(d, f"Click: {active}", (10, 28), cv2.FONT_HERSHEY_SIMPLEX, 0.62, (0, 220, 255), 2)
        cv2.putText(d, f"Progress: {len(points)}/{num_points}", (10, 54), cv2.FONT_HERSHEY_SIMPLEX, 0.5, (220, 220, 220), 1)
        cv2.putText(d, "Q or Esc = cancel", (10, 78), cv2.FONT_HERSHEY_SIMPLEX, 0.48, (128, 128, 128), 1)

    def on_mouse(event: int, x: int, y: int, _a: int, _b: int) -> None:
        nonlocal display
        if event != cv2.EVENT_LBUTTONDOWN:
            return
        if len(points) >= num_points:
            return
        points.append((x, y))
        display = img.copy()
        draw_scene(display, min(len(points), num_points - 1))
        cv2.imshow(title, display)

    cv2.namedWindow(title)
    cv2.setMouseCallback(title, on_mouse)

    for i in range(num_points):
        display = img.copy()
        draw_scene(display, i)
        cv2.imshow(title, display)
        while len(points) <= i:
            key = cv2.waitKey(50)
            if key == ord("q") or key == 27:
                cv2.destroyAllWindows()
                raise RuntimeError("Net floor calibration cancelled.")
        if len(points) < num_points:
            continue

    cv2.destroyAllWindows()
    return (img, points, w, h)
