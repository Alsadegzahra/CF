"""
Use a pose model to get a stable ground point (ankles/knees) per person instead of bbox bottom.
Improves court mapping and reduces jitter when players crouch or extend.
Uses Ultralytics YOLO pose (e.g. yolov8n-pose.pt); COCO 17 keypoints.
"""
from __future__ import annotations

from collections import defaultdict
from pathlib import Path
from typing import List, Optional, Tuple, Any

import cv2
import numpy as np

# COCO keypoint indices (Ultralytics / COCO order, 0-based)
# 15 = left_ankle, 16 = right_ankle; 13 = left_knee, 14 = right_knee
IDX_LEFT_ANKLE = 15
IDX_RIGHT_ANKLE = 16
IDX_LEFT_KNEE = 13
IDX_RIGHT_KNEE = 14
# Min confidence (3rd value in keypoint) to use a keypoint
KPT_CONF_THRESH = 0.25

# COCO 17 keypoints skeleton edges (0-based indices) for drawing
# Each pair (a, b) = draw line between keypoint a and b
SKELETON_EDGES: List[Tuple[int, int]] = [
    (15, 13), (13, 11), (16, 14), (14, 12), (11, 12),  # legs + pelvis
    (5, 11), (6, 12), (5, 6), (5, 7), (7, 9), (6, 8), (8, 10),  # torso + arms
    (1, 2), (0, 1), (0, 2), (1, 3), (2, 4), (3, 5), (4, 6),  # face + neck
]


def load_pose_model(model_name_or_path: Optional[str] = None):
    """
    Load Ultralytics YOLO pose model. Default: yolov8n-pose.pt (lightweight).
    Returns the model or None if pose deps are not available.
    """
    try:
        from ultralytics import YOLO
    except ImportError:
        return None
    name = model_name_or_path or "yolov8n-pose.pt"
    try:
        return YOLO(name)
    except Exception:
        return None


def get_ground_point_from_pose(
    frame_bgr: np.ndarray,
    bbox_xyxy: List[float],
    pose_model,
    *,
    use_knees_if_no_ankles: bool = True,
) -> Optional[Tuple[float, float]]:
    """
    Run pose on the person crop and return ground point (x, y) in image coordinates.
    Prefer mid-ankle; else mid-knee; else None (caller should use bbox bottom).
    """
    if pose_model is None or frame_bgr is None or not bbox_xyxy:
        return None
    x1, y1, x2, y2 = [int(round(v)) for v in bbox_xyxy[:4]]
    w, h = frame_bgr.shape[1], frame_bgr.shape[0]
    # Add small padding; clamp to image
    pad = 8
    x1 = max(0, x1 - pad)
    y1 = max(0, y1 - pad)
    x2 = min(w, x2 + pad)
    y2 = min(h, y2 + pad)
    if x2 <= x1 or y2 <= y1:
        return None
    crop = frame_bgr[y1:y2, x1:x2]
    if crop.size == 0:
        return None
    try:
        results = pose_model.predict(
            crop,
            conf=0.2,
            verbose=False,
        )
    except Exception:
        return None
    if not results or results[0].keypoints is None:
        return None
    kpts = results[0].keypoints
    # shape: (1, 17, 3) for single person; (x, y, conf) in crop coords
    data = kpts.data.cpu().numpy()
    if data.size == 0 or data.shape[0] == 0:
        return None
    kps = data[0]  # (17, 3)
    if kps.shape[0] < 17:
        return None

    def get_mid(idx_a: int, idx_b: int) -> Optional[Tuple[float, float]]:
        xa, ya, ca = float(kps[idx_a][0]), float(kps[idx_a][1]), float(kps[idx_a][2])
        xb, yb, cb = float(kps[idx_b][0]), float(kps[idx_b][1]), float(kps[idx_b][2])
        if ca >= KPT_CONF_THRESH and cb >= KPT_CONF_THRESH:
            return ((xa + xb) * 0.5, (ya + yb) * 0.5)
        if ca >= KPT_CONF_THRESH:
            return (xa, ya)
        if cb >= KPT_CONF_THRESH:
            return (xb, yb)
        return None

    # Prefer ankles (ground contact)
    mid = get_mid(IDX_LEFT_ANKLE, IDX_RIGHT_ANKLE)
    if mid is None and use_knees_if_no_ankles:
        mid = get_mid(IDX_LEFT_KNEE, IDX_RIGHT_KNEE)
    if mid is None:
        return None
    # Convert crop coords to image coords
    cx_crop, cy_crop = mid
    cx_img = x1 + cx_crop
    cy_img = y1 + cy_crop
    return (round(cx_img, 2), round(cy_img, 2))


def get_pose_ground_point_and_keypoints(
    frame_bgr: np.ndarray,
    bbox_xyxy: List[float],
    pose_model: Any,
    *,
    use_knees_if_no_ankles: bool = True,
) -> Optional[Tuple[Tuple[float, float], List[Tuple[float, float, float]]]]:
    """
    Run pose on the person crop; return (ground_point_xy, keypoints) in image coordinates.
    keypoints: list of 17 (x, y, conf) in image coords, for drawing skeleton.
    Returns None if pose fails.
    """
    if pose_model is None or frame_bgr is None or not bbox_xyxy:
        return None
    x1, y1, x2, y2 = [int(round(v)) for v in bbox_xyxy[:4]]
    w, h = frame_bgr.shape[1], frame_bgr.shape[0]
    pad = 8
    x1 = max(0, x1 - pad)
    y1 = max(0, y1 - pad)
    x2 = min(w, x2 + pad)
    y2 = min(h, y2 + pad)
    if x2 <= x1 or y2 <= y1:
        return None
    crop = frame_bgr[y1:y2, x1:x2]
    if crop.size == 0:
        return None
    try:
        results = pose_model.predict(crop, conf=0.2, verbose=False)
    except Exception:
        return None
    if not results or results[0].keypoints is None:
        return None
    data = results[0].keypoints.data.cpu().numpy()
    if data.size == 0 or data.shape[0] == 0:
        return None
    kps = data[0]
    if kps.shape[0] < 17:
        return None

    def get_mid(idx_a: int, idx_b: int) -> Optional[Tuple[float, float]]:
        xa, ya, ca = float(kps[idx_a][0]), float(kps[idx_a][1]), float(kps[idx_a][2])
        xb, yb, cb = float(kps[idx_b][0]), float(kps[idx_b][1]), float(kps[idx_b][2])
        if ca >= KPT_CONF_THRESH and cb >= KPT_CONF_THRESH:
            return ((xa + xb) * 0.5, (ya + yb) * 0.5)
        if ca >= KPT_CONF_THRESH:
            return (xa, ya)
        if cb >= KPT_CONF_THRESH:
            return (xb, yb)
        return None

    mid = get_mid(IDX_LEFT_ANKLE, IDX_RIGHT_ANKLE)
    if mid is None and use_knees_if_no_ankles:
        mid = get_mid(IDX_LEFT_KNEE, IDX_RIGHT_KNEE)
    if mid is None:
        return None
    cx_img = x1 + mid[0]
    cy_img = y1 + mid[1]
    ground_point = (round(cx_img, 2), round(cy_img, 2))
    # Keypoints in image coords: 17 * (x, y, conf)
    keypoints: List[Tuple[float, float, float]] = []
    for i in range(17):
        kx = x1 + float(kps[i][0])
        ky = y1 + float(kps[i][1])
        kc = float(kps[i][2])
        keypoints.append((round(kx, 2), round(ky, 2), round(kc, 3)))
    return (ground_point, keypoints)


def refine_tracks_with_pose(
    video_path: Path,
    raw_tracks: List[dict],
    pose_model,
    *,
    progress_every: Optional[int] = None,
) -> None:
    """
    Update raw_tracks in place: set x_pixel, y_pixel from pose ground point where available.
    Groups by frame, reads each frame once, runs pose on each person crop.
    """
    if not raw_tracks or pose_model is None:
        return
    by_frame: dict = defaultdict(list)
    for r in raw_tracks:
        f = r.get("frame")
        if f is not None and r.get("bbox_xyxy"):
            by_frame[f].append(r)
    if not by_frame:
        return
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return
    total = len(by_frame)
    processed = 0
    for frame_idx in sorted(by_frame.keys()):
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret or frame is None:
            continue
        for r in by_frame[frame_idx]:
            bbox = r.get("bbox_xyxy")
            if not bbox or len(bbox) < 4:
                continue
            out = get_pose_ground_point_and_keypoints(frame, bbox, pose_model)
            if out is not None:
                ground_pt, keypoints = out
                r["x_pixel"], r["y_pixel"] = ground_pt[0], ground_pt[1]
                # Store keypoints for overlay skeleton drawing: list of [x, y, conf]
                r["keypoints"] = [[p[0], p[1], p[2]] for p in keypoints]
        processed += 1
        if progress_every and processed % progress_every == 0 and total > 0:
            pct = min(100, round(100 * processed / total, 1))
            print(f"   ... pose refinement {processed}/{total} frames ({pct}%)")
    cap.release()
