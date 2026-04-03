"""
Draw detection/tracking overlays on frames: bboxes + player_id; optional pose skeleton.
Uses: OpenCV, tracks list (frame, player_id, bbox_xyxy, optional keypoints).
"""
from __future__ import annotations

from typing import List

import cv2
import numpy as np

# COCO 17 keypoints skeleton edges (0-based) for drawing pose
from src.vision.pose.ground_point import SKELETON_EDGES

# Min keypoint confidence to draw joint or edge
POSE_KPT_CONF_THRESH = 0.25


def _draw_pose_skeleton(
    out: np.ndarray,
    keypoints: List[list],
    *,
    color: tuple = (0, 255, 255),
    thickness: int = 2,
    radius: int = 3,
) -> None:
    """
    Draw COCO 17-keypoint skeleton on frame. keypoints: list of 17 [x, y, conf].
    Mutates out in place.
    """
    if not keypoints or len(keypoints) < 17:
        return
    for (i, j) in SKELETON_EDGES:
        if i >= len(keypoints) or j >= len(keypoints):
            continue
        a, b = keypoints[i], keypoints[j]
        if len(a) < 3 or len(b) < 3:
            continue
        conf_a, conf_b = float(a[2]), float(b[2])
        if conf_a < POSE_KPT_CONF_THRESH or conf_b < POSE_KPT_CONF_THRESH:
            continue
        pt_a = (int(round(a[0])), int(round(a[1])))
        pt_b = (int(round(b[0])), int(round(b[1])))
        cv2.line(out, pt_a, pt_b, color, thickness)
    for kpt in keypoints:
        if len(kpt) < 3 or float(kpt[2]) < POSE_KPT_CONF_THRESH:
            continue
        cx, cy = int(round(kpt[0])), int(round(kpt[1]))
        cv2.circle(out, (cx, cy), radius, color, -1)


def draw_tracks_on_frame(
    frame_bgr: np.ndarray,
    tracks_for_frame: List[dict],
    *,
    color: tuple = (0, 255, 0),
    thickness: int = 2,
    font_scale: float = 0.7,
    draw_pose: bool = True,
    pose_color: tuple = (0, 255, 255),
) -> np.ndarray:
    """
    Draw each track's bbox and player_id on the frame. If a track has 'keypoints'
    (from pose refinement) and draw_pose is True, draw the pose skeleton first.
    Each track must have 'bbox_xyxy' and 'player_id'.
    """
    out = frame_bgr.copy()
    for t in tracks_for_frame:
        bbox = t.get("bbox_xyxy")
        if not bbox or len(bbox) != 4:
            continue
        # Draw pose skeleton when available (so it appears under the bbox)
        if draw_pose and t.get("keypoints"):
            _draw_pose_skeleton(out, t["keypoints"], color=pose_color, thickness=thickness)
        x1, y1, x2, y2 = int(bbox[0]), int(bbox[1]), int(bbox[2]), int(bbox[3])
        cv2.rectangle(out, (x1, y1), (x2, y2), color, thickness)
        conf = t.get("confidence")
        display_id = t.get("canonical_id")
        id_str = f"P{display_id}" if display_id is not None else "?"
        label = id_str if conf is None else f"{id_str} {conf:.2f}"
        (tw, th), _ = cv2.getTextSize(label, cv2.FONT_HERSHEY_SIMPLEX, font_scale, 1)
        cv2.rectangle(out, (x1, y1 - th - 6), (x1 + tw + 4, y1), color, -1)
        cv2.putText(
            out, label, (x1 + 2, y1 - 4),
            cv2.FONT_HERSHEY_SIMPLEX, font_scale, (0, 0, 0), 1,
        )
    return out


def group_tracks_by_frame(tracks: List[dict]) -> dict:
    """Return {frame_index: [track, ...]}."""
    by_frame: dict = {}
    for t in tracks:
        f = t.get("frame", 0)
        by_frame.setdefault(f, []).append(t)
    return by_frame
