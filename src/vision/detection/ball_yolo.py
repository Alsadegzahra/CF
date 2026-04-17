"""
Ball detection with a **separate** YOLO checkpoint from player detection.

- Set ``COURTFLOW_BALL_MODEL`` or place ``models/ball_best.pt`` in the repo root, or pass
  ``ball_model`` from the pipeline / ``--ball-model`` on run-match.
- Single-class ball models: use ``ball_class_id=0`` (default).
- Multi-class: set env ``COURTFLOW_BALL_CLASS_ID`` or pass ``ball_class_id``; if ``None``,
  the highest-confidence box among **all** classes is kept per frame (use with care).
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import List, Optional, Tuple

from src.vision.detection.yolo import _project_root, _resolve_model_path

# Optional default path (gitignored like models/best.pt)
DEFAULT_BALL_WEIGHTS_REL = Path("models") / "ball_best.pt"


def resolve_ball_model_path(explicit: Optional[str] = None) -> Optional[str]:
    """Return path string to load, or None to skip ball inference."""
    v = (explicit or os.getenv("COURTFLOW_BALL_MODEL") or "").strip()
    if v:
        p = _resolve_model_path(v)
        return str(p) if p is not None else None
    rel = _project_root() / DEFAULT_BALL_WEIGHTS_REL
    if rel.exists():
        return str(rel.resolve())
    return None


def load_ball_model(path: str):
    try:
        from ultralytics import YOLO
    except ImportError as e:
        raise ImportError("ultralytics is required for ball detection") from e

    p = _resolve_model_path(path)
    if p is not None:
        return YOLO(str(p))
    return YOLO(path)


def best_ball_detection(
    frame_bgr,
    model,
    *,
    conf: float,
    iou: float,
    ball_class_id: Optional[int],
) -> Optional[Tuple[List[float], float, int]]:
    """
    One best ball box for this frame (highest confidence).
    Returns (bbox_xyxy, confidence, class_id) or None.
    """
    kwargs = dict(conf=conf, iou=iou, verbose=False)
    if ball_class_id is not None:
        kwargs["classes"] = [int(ball_class_id)]
    results = model.predict(frame_bgr, **kwargs)
    best = None
    best_conf = -1.0
    for r in results:
        if r.boxes is None:
            continue
        for i in range(len(r.boxes)):
            c = float(r.boxes.conf[i].cpu().numpy())
            if c <= best_conf:
                continue
            xyxy = r.boxes.xyxy[i].cpu().numpy().tolist()
            cls_id = int(r.boxes.cls[i].cpu().numpy())
            best_conf = c
            best = ([float(x) for x in xyxy], c, cls_id)
    if best is None:
        return None
    return best


def bbox_center(xyxy: List[float]) -> Tuple[float, float]:
    x1, y1, x2, y2 = xyxy
    return ((x1 + x2) * 0.5, (y1 + y2) * 0.5)
