"""
Save/load all calibration artifacts for a court (H, calib frame, ROI, undistort).
Matches flow: capture frame → (optional undistort) → manual pointing → H → ROI.
Uses: utils/io, court/calibration/homography, court/calibration/roi
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import cv2

from src.domain.models import CalibrationHomography
from src.court.calibration.homography import load_homography, save_homography
from src.court.calibration.roi import save_roi_mask, save_roi_polygon
from src.utils.io import write_json

CALIB_FRAME_FILENAME = "calib_frame.jpg"
CALIBRATION_POINTS_FILENAME = "calibration_points.json"


def get_homography_path(calibration_dir: Path) -> Path:
    return calibration_dir / "homography.json"


def load_calibration_artifacts(calibration_dir: Path) -> Optional[CalibrationHomography]:
    """Load homography from court calibration dir. ROI/undistort loaded separately if needed."""
    return load_homography(get_homography_path(calibration_dir))


def save_calibration_points_json(
    calibration_dir: Path,
    *,
    points_px: List[Tuple[float, float]],
    num_points: int,
    image_width: int,
    image_height: int,
    court_width_m: float,
    court_height_m: float,
    labels: Optional[List[str]] = None,
    reprojection_rms_px: Optional[float] = None,
) -> Path:
    """
    Persist clicked court points (image pixels) for debugging / recompute / tooling parity
    with common padel CV repos that save keypoints JSON alongside H.
    """
    calibration_dir.mkdir(parents=True, exist_ok=True)
    out_path = calibration_dir / CALIBRATION_POINTS_FILENAME
    payload: Dict[str, Any] = {
        "schema_version": "v1",
        "num_points": num_points,
        "image_width": image_width,
        "image_height": image_height,
        "court_width_m": court_width_m,
        "court_height_m": court_height_m,
        "points_px": [[float(x), float(y)] for x, y in points_px],
    }
    if labels is not None:
        payload["labels"] = list(labels)
    if reprojection_rms_px is not None:
        payload["reprojection_rms_px"] = round(float(reprojection_rms_px), 3)
    write_json(out_path, payload)
    return out_path


def save_calibration_artifacts(
    calibration_dir: Path,
    calib: CalibrationHomography,
    *,
    calib_frame: Optional[np.ndarray] = None,
    roi_polygon_px: Optional[List[Tuple[float, float]]] = None,
    calibration_points_px: Optional[List[Tuple[float, float]]] = None,
    calibration_point_labels: Optional[List[str]] = None,
    reprojection_rms_px: Optional[float] = None,
) -> Path:
    """
    Save homography and optional calibration artifacts.
    - homography.json (always)
    - calib_frame.jpg (if calib_frame provided) – reference image from manual setup
    - roi_polygon.json + roi_mask.png (if roi_polygon_px provided) – playable court boundary
    - calibration_points.json (if calibration_points_px provided) – clicked points + labels
    """
    calibration_dir.mkdir(parents=True, exist_ok=True)
    path = get_homography_path(calibration_dir)
    save_homography(path, calib)

    if calib_frame is not None:
        frame_path = calibration_dir / CALIB_FRAME_FILENAME
        cv2.imwrite(str(frame_path), calib_frame)

    if roi_polygon_px is not None and len(roi_polygon_px) >= 3:
        save_roi_polygon(calibration_dir, roi_polygon_px)
        save_roi_mask(
            calibration_dir,
            roi_polygon_px,
            calib.image_width,
            calib.image_height,
        )

    if calibration_points_px is not None and len(calibration_points_px) >= 4:
        n_pts = calib.num_points if calib.num_points is not None else len(calibration_points_px)
        save_calibration_points_json(
            calibration_dir,
            points_px=calibration_points_px,
            num_points=int(n_pts),
            image_width=calib.image_width,
            image_height=calib.image_height,
            court_width_m=float(calib.court_width_m or 10.0),
            court_height_m=float(calib.court_height_m or 20.0),
            labels=calibration_point_labels,
            reprojection_rms_px=reprojection_rms_px,
        )

    return path
