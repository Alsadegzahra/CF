"""
Optional automatic calibration fix when quick_check fails. Tries to re-detect court and compute H.
Uses court_detect (Canny + Hough lines -> intersections -> 4 corners -> homography).
If it fails or is uncertain, caller should fall back to manual calibration.
Saves auto_detect_preview.png when successful so you can check if the detected court is correct.
"""
from __future__ import annotations

from pathlib import Path
from typing import List, Optional

import cv2

from src.domain.models import CalibrationHomography
from src.court.calibration.court_detect import estimate_homography_from_frame
from src.pipeline.paths import court_calibration_dir

AUTO_DETECT_PREVIEW_FILENAME = "auto_detect_preview.png"


def _candidate_frame_indices(video_path: Path) -> List[int]:
    """Try several spread-out frames (broadcast padel often has occluded first frame)."""
    path = Path(video_path)
    if path.suffix.lower() not in (".mp4", ".mov", ".avi", ".mkv"):
        return [0]
    cap = cv2.VideoCapture(str(path))
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    cap.release()
    if n <= 1:
        return [0]
    raw = [0, n // 4, n // 2, (3 * n) // 4, n - 1]
    idxs = sorted({min(max(0, i), n - 1) for i in raw})
    return idxs


def try_auto_fix(
    court_id: str,
    video_path: Path,
    *,
    frame_index: int = 0,
) -> Optional[CalibrationHomography]:
    """
    Try to recover calibration from a frame (court line detection -> homography).
    Tries multiple frame indices when video input (same idea as DS_Padel retry loop).
    When successful, saves a preview image to calibration_dir/auto_detect_preview.png
    so you can verify the detected court quad. Returns new CalibrationHomography if
    successful, else None → caller should prompt for manual.
    """
    calib_dir = court_calibration_dir(court_id)
    calib_dir.mkdir(parents=True, exist_ok=True)
    indices = _candidate_frame_indices(video_path)
    if frame_index not in indices:
        indices = sorted(set(indices + [frame_index]))
    last_preview = None
    for fi in indices:
        calib, preview = estimate_homography_from_frame(video_path, frame_index=fi)
        last_preview = preview
        if calib is not None:
            if preview is not None:
                preview_path = calib_dir / AUTO_DETECT_PREVIEW_FILENAME
                cv2.imwrite(str(preview_path), preview)
            return calib
    if last_preview is not None:
        preview_path = calib_dir / (AUTO_DETECT_PREVIEW_FILENAME.replace(".png", "_last_try.png"))
        cv2.imwrite(str(preview_path), last_preview)
    return None
