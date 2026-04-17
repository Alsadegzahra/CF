"""
Single entry point for the "intelligence" layer: detection + tracking + ROI + ground point.
Default: ByteTrack (like padel_analytics / DS_Padel) for stable IDs; optional BoT-SORT with ReID.
Used by: pipeline/stages.py stage_02_track.
"""
from __future__ import annotations

import os
from pathlib import Path
from typing import Any, Dict, List, Optional

import cv2


def _dist(p: tuple, q: tuple) -> float:
    return ((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2) ** 0.5


def estimate_canonical_swap_rate(raw_tracks: List[dict]) -> float:
    """
    From raw_tracks with canonical_id, estimate how often two players' labels appear swapped
    between consecutive frames (position of P1 at t+1 closer to P2 at t and vice versa).
    High rate suggests same kit (ReID confusing 1&2 or 3&4). Returns rate in [0, 1].
    """
    if not raw_tracks:
        return 0.0
    by_frame: dict = {}
    for r in raw_tracks:
        cid = r.get("canonical_id")
        if cid not in (1, 2, 3, 4):
            continue
        f = r.get("frame")
        if f is None:
            continue
        x, y = r.get("x_pixel", 0), r.get("y_pixel", 0)
        if f not in by_frame:
            by_frame[f] = {}
        by_frame[f][cid] = (float(x), float(y))
    frames = sorted(by_frame.keys())
    swaps = 0
    pairs_checked = 0
    for i in range(len(frames) - 1):
        ft, ft1 = frames[i], frames[i + 1]
        pos_t = by_frame[ft]
        pos_t1 = by_frame[ft1]
        for cid1 in (1, 2, 3, 4):
            for cid2 in range(cid1 + 1, 5):
                if cid1 not in pos_t or cid2 not in pos_t or cid1 not in pos_t1 or cid2 not in pos_t1:
                    continue
                p1_t, p2_t = pos_t[cid1], pos_t[cid2]
                p1_t1, p2_t1 = pos_t1[cid1], pos_t1[cid2]
                d_same = _dist(p1_t, p1_t1) + _dist(p2_t, p2_t1)
                d_swap = _dist(p1_t, p2_t1) + _dist(p2_t, p1_t1)
                if d_swap < d_same:
                    swaps += 1
                pairs_checked += 1
    return swaps / pairs_checked if pairs_checked else 0.0


# EMA smoothing: 0.6 = more smoothing (less jitter), 0.9 = less smoothing
SMOOTH_ALPHA = 0.6


def _smooth_track_positions(raw_tracks: List[dict], tracks: List[dict]) -> None:
    """
    Smooth x_pixel, y_pixel and bbox_xyxy per canonical player over time (EMA) to reduce jitter.
    Mutates raw_tracks in place, then updates tracks with smoothed positions.
    """
    if not raw_tracks:
        return
    by_cid: dict = {}
    for r in raw_tracks:
        cid = r.get("canonical_id")
        if cid not in (1, 2, 3, 4):
            continue
        f = r.get("frame")
        if f is None:
            continue
        by_cid.setdefault(cid, []).append((f, r))
    for cid in (1, 2, 3, 4):
        if cid not in by_cid:
            continue
        lst = sorted(by_cid[cid], key=lambda x: x[0])
        prev_x = prev_y = None
        prev_bbox = None
        for _f, r in lst:
            x = float(r.get("x_pixel", 0))
            y = float(r.get("y_pixel", 0))
            bbox = r.get("bbox_xyxy")
            if bbox and len(bbox) == 4:
                bbox = [float(bbox[0]), float(bbox[1]), float(bbox[2]), float(bbox[3])]
            else:
                bbox = None
            if prev_x is None:
                prev_x, prev_y = x, y
                prev_bbox = bbox
            else:
                prev_x = SMOOTH_ALPHA * prev_x + (1 - SMOOTH_ALPHA) * x
                prev_y = SMOOTH_ALPHA * prev_y + (1 - SMOOTH_ALPHA) * y
                if prev_bbox is not None and bbox is not None:
                    prev_bbox = [SMOOTH_ALPHA * prev_bbox[i] + (1 - SMOOTH_ALPHA) * bbox[i] for i in range(4)]
            r["x_pixel"] = round(prev_x, 2)
            r["y_pixel"] = round(prev_y, 2)
            if prev_bbox is not None:
                r["bbox_xyxy"] = [round(prev_bbox[i], 1) for i in range(4)]
    # Sync smoothed positions to tracks (for report/mapping)
    lookup = {(r["frame"], r["canonical_id"]): (r["x_pixel"], r["y_pixel"]) for r in raw_tracks if r.get("canonical_id") in (1, 2, 3, 4)}
    for t in tracks:
        key = (t.get("frame"), t.get("player_id"))
        if key in lookup:
            t["x_pixel"], t["y_pixel"] = lookup[key]


def correct_canonical_swaps(
    raw_tracks: List[dict],
    tracks: List[dict],
    calib: Optional[object] = None,
) -> None:
    """
    Post-process: where two players' positions suggest they swapped labels between
    consecutive frames, flip the labels at the current frame so IDs stay consistent.
    Mutates raw_tracks and tracks in place. Pairs (1,2) and (3,4) checked independently.
    When calib is provided, only allow a swap if both players stay on the same court half
    (left/right of net) after the flip; rejects flips that would put P1 or P2 on the wrong side.
    """
    if not raw_tracks:
        return
    by_frame: dict = {}
    for r in raw_tracks:
        cid = r.get("canonical_id")
        if cid not in (1, 2, 3, 4):
            continue
        f = r.get("frame")
        if f is None:
            continue
        x, y = r.get("x_pixel", 0), r.get("y_pixel", 0)
        if f not in by_frame:
            by_frame[f] = {}
        by_frame[f][cid] = (float(x), float(y))
    frames = sorted(by_frame.keys())
    pixel_to_court_fn = None
    if calib is not None:
        try:
            from src.vision.mapping.img_to_court import pixel_to_court
            pixel_to_court_fn = lambda x, y: pixel_to_court(x, y, calib)
        except Exception:
            pixel_to_court_fn = None
    for i in range(1, len(frames)):
        ft, ft1 = frames[i - 1], frames[i]
        pos_t = by_frame.get(ft, {})
        pos_t1 = by_frame.get(ft1, {})
        for (a, b) in [(1, 2), (3, 4)]:
            if a not in pos_t or b not in pos_t or a not in pos_t1 or b not in pos_t1:
                continue
            p_a_t, p_b_t = pos_t[a], pos_t[b]
            p_a_t1, p_b_t1 = pos_t1[a], pos_t1[b]
            d_same = _dist(p_a_t, p_a_t1) + _dist(p_b_t, p_b_t1)
            d_swap = _dist(p_a_t, p_b_t1) + _dist(p_b_t, p_a_t1)
            if d_swap >= d_same:
                continue
            if pixel_to_court_fn is not None:
                from src.vision.tracking.canonical_ids import NET_X_COURT
                xa_t, ya_t = p_a_t
                xb_t, yb_t = p_b_t
                xa_t1, ya_t1 = p_a_t1
                xb_t1, yb_t1 = p_b_t1
                xc_a_t, _ = pixel_to_court_fn(xa_t, ya_t)
                xc_b_t, _ = pixel_to_court_fn(xb_t, yb_t)
                xc_a_t1, _ = pixel_to_court_fn(xa_t1, ya_t1)
                xc_b_t1, _ = pixel_to_court_fn(xb_t1, yb_t1)
                # After swap: new P1 = old P2 at t1, new P2 = old P1 at t1
                side_a_t = xc_a_t < NET_X_COURT
                side_b_t = xc_b_t < NET_X_COURT
                side_a_after_swap = xc_b_t1 < NET_X_COURT  # P1 would get position of old P2 at t1
                side_b_after_swap = xc_a_t1 < NET_X_COURT  # P2 would get position of old P1 at t1
                if side_a_after_swap != side_a_t or side_b_after_swap != side_b_t:
                    continue  # reject: would move a player to wrong court half
            for r in raw_tracks:
                if r.get("frame") == ft1 and r.get("canonical_id") in (a, b):
                    r["canonical_id"] = b if r["canonical_id"] == a else a
            for t in tracks:
                if t.get("frame") == ft1 and t.get("player_id") in (a, b):
                    t["player_id"] = b if t["player_id"] == a else a
            by_frame[ft1][a], by_frame[ft1][b] = by_frame[ft1][b], by_frame[ft1][a]


def run_tracking(
    video_path: Path,
    court_id: str,
    match_dir: Path,
    *,
    sample_every_n_frames: int = 1,
    conf: float = 0.2,
    iou: float = 0.5,
    tracker: Optional[str] = None,
    detection_model: Optional[str] = None,
    use_roi: bool = False,
    detection_only: bool = False,
    skip_first_seconds: float = 0.0,
    raw_tracks_out: Optional[List[dict]] = None,
    use_pose: bool = False,
) -> List[dict]:
    """
    Run detection + BoT-SORT tracking, then pick 4 players from first frame (DS_Padel / padel_analytics style).
    Returns list of dicts: frame, timestamp, player_id, x_pixel, y_pixel, bbox_xyxy.

    - BoT-SORT keeps IDs stable; we then pick the 4 players from the first frame with 4 IDs:
      by distance to court_center (if use_roi/calibration) or by position (-y, x). Only those 4 are kept and remapped to 1-4.
    - skip_first_seconds: do not record tracks for the first N seconds (intro/ads); we still run the tracker so the "first frame" we use for picking 4 is after the skip. Use for long/full matches.
    - use_roi=True: filter detections to court polygon before recording (like padel_analytics PolygonZone).
    - detection_only: no tracker; assign 1-4 by position each frame (debug only).
    """
    try:
        from src.vision.detection.yolo import (
            _get_model,
            track_persons,
            track_persons_video,
            detect_persons,
        )
        from src.vision.roi_filter.filter import (
            load_roi_for_match,
            filter_detections_by_roi,
            roi_centroid,
            keep_closest_n_detections,
        )
        from src.vision.tracking.ground_point import bbox_to_ground_point
        from src.vision.tracking.canonical_ids import canonicalize_from_first_frame
        from src.pipeline.paths import court_calibration_dir
    except ImportError:
        return []

    match_calib_dir = match_dir / "calibration"
    court_calib_dir = court_calibration_dir(court_id)
    calib = None
    try:
        from src.court.calibration.artifacts import load_calibration_artifacts
        calib = load_calibration_artifacts(match_calib_dir)
    except Exception:
        calib = None
    if use_roi:
        roi_polygon = load_roi_for_match(match_calib_dir, court_calib_dir)
        court_center = roi_centroid(roi_polygon) if roi_polygon else None
    else:
        roi_polygon = None
        court_center = None

    cap = cv2.VideoCapture(str(video_path))
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    skip_frames = int(skip_first_seconds * fps) if skip_first_seconds > 0 else 0
    model = _get_model(detection_model)
    tracks: List[dict] = []
    frame_idx = 0
    processed = 0
    progress_every = max(1, (total_frames // max(1, sample_every_n_frames)) // 20)

    if detection_only:
        # No tracker: detect each frame, assign 1-4 by position (IDs can jump between frames)
        while True:
            ret, frame = cap.read()
            if not ret or frame is None:
                break
            if frame_idx % sample_every_n_frames != 0:
                frame_idx += 1
                continue
            dets = detect_persons(frame, model=model, conf=conf, iou=iou)
            if roi_polygon:
                dets = filter_detections_by_roi(dets, roi_polygon)
            if court_center and len(dets) > 4:
                dets = keep_closest_n_detections(dets, court_center, n=4)
            elif not court_center and len(dets) > 4:
                dets = sorted(dets, key=lambda d: -(d.get("confidence") or 0))[:4]
            if dets:
                def _key(d):
                    x, y = bbox_to_ground_point(d.get("bbox_xyxy") or [0, 0, 0, 0])
                    return (-y, x)
                for i, d in enumerate(sorted(dets, key=_key)[:4]):
                    d["track_id"] = i + 1
            for d in dets:
                tid = d.get("track_id", -1)
                if tid < 0:
                    continue
                if frame_idx < skip_frames:
                    continue
                x, y = bbox_to_ground_point(d["bbox_xyxy"])
                tracks.append({
                    "frame": frame_idx,
                    "timestamp": round(frame_idx / fps, 3),
                    "player_id": tid,
                    "x_pixel": round(x, 2),
                    "y_pixel": round(y, 2),
                    "bbox_xyxy": d["bbox_xyxy"],
                })
            processed += 1
            if progress_every and processed % progress_every == 0 and total_frames > 0:
                pct = min(100, round(100 * (frame_idx + 1) / total_frames, 1))
                print(f"   ... tracking frame {frame_idx + 1}/{total_frames} ({pct}%)")
            frame_idx += 1
    else:
        # BoT-SORT via Ultralytics recommended API: track(source=video_path, stream=True)
        # so tracker state is maintained for the whole video (one predictor run).
        raw_tracks = []
        tracker_cfg = tracker
        if tracker_cfg is None:
            _cfg = Path(__file__).resolve().parents[2] / "config" / "trackers" / "bytetrack_padel.yaml"
            if _cfg.exists():
                tracker_cfg = str(_cfg)
        else:
            # Resolve relative paths (e.g. config/trackers/bytetrack_padel.yaml) from project root
            p = Path(tracker_cfg)
            if not p.is_absolute():
                root = Path(__file__).resolve().parents[2]
                candidate = (root / p).resolve()
                if candidate.exists():
                    tracker_cfg = str(candidate)
        cap.release()
        cap = None  # so we don't double-release at end
        processed = 0
        pose_model = None
        if use_pose:
            try:
                from src.vision.pose.ground_point import load_pose_model, get_pose_ground_point_and_keypoints
                pose_model = load_pose_model()
            except Exception:
                pose_model = None
        need_frames_for_crop_pose = use_pose and pose_model is not None
        gen = track_persons_video(
            video_path, model=model, conf=conf, iou=iou, tracker=tracker_cfg,
            yield_frames=need_frames_for_crop_pose,
        )
        for item in gen:
            if len(item) == 3:
                frame_idx, dets, frame_bgr = item[0], item[1], item[2]
            else:
                frame_idx, dets = item[0], item[1]
                frame_bgr = None
            if frame_idx % sample_every_n_frames != 0:
                continue
            if roi_polygon:
                dets = filter_detections_by_roi(dets, roi_polygon)
            for d in dets:
                tid = d.get("track_id")
                try:
                    tid_int = int(tid) if tid is not None and int(tid) >= 0 else None
                except (TypeError, ValueError):
                    tid_int = None
                x, y = bbox_to_ground_point(d["bbox_xyxy"])
                raw_rec = {
                    "frame": frame_idx,
                    "timestamp": round(frame_idx / fps, 3),
                    "player_id": tid_int,
                    "x_pixel": round(x, 2),
                    "y_pixel": round(y, 2),
                    "bbox_xyxy": d["bbox_xyxy"],
                }
                if d.get("confidence") is not None:
                    raw_rec["confidence"] = round(float(d["confidence"]), 3)
                if pose_model is not None and frame_bgr is not None:
                    try:
                        out_pose = get_pose_ground_point_and_keypoints(frame_bgr, d["bbox_xyxy"], pose_model)
                        if out_pose is not None:
                            ground_pt, keypoints = out_pose
                            raw_rec["x_pixel"], raw_rec["y_pixel"] = ground_pt[0], ground_pt[1]
                            raw_rec["keypoints"] = [[p[0], p[1], p[2]] for p in keypoints]
                    except Exception:
                        pass
                raw_tracks.append(raw_rec)
                if tid_int is not None and frame_idx >= skip_frames:
                    tracks.append(raw_rec.copy())
            processed += 1
            if progress_every and processed % progress_every == 0 and total_frames > 0:
                pct = min(100, round(100 * (frame_idx + 1) / total_frames, 1))
                print(f"   ... tracking frame {frame_idx + 1}/{total_frames} ({pct}%)")
        # Sync pose-refined positions into tracks when pose ran in loop (already in raw_rec; tracks are copies)
        if use_pose and pose_model is not None and raw_tracks:
            raw_lookup = {(r["frame"], r.get("player_id")): (r["x_pixel"], r["y_pixel"]) for r in raw_tracks}
            for t in tracks:
                key = (t.get("frame"), t.get("player_id"))
                if key in raw_lookup:
                    t["x_pixel"], t["y_pixel"] = raw_lookup[key]
        # Pick 4 from first frame; filter and remap to 1-4 for report (use court side if calib)
        tracks = canonicalize_from_first_frame(
            tracks, n_players=4, court_center=court_center, calib=calib
        )
        if raw_tracks_out is not None:
            # Map (frame, tracker_id) -> canonical 1-4 for overlay labels
            canon_map = {}
            for t in tracks:
                ot = t.get("original_track_id")
                if ot is not None:
                    canon_map[(t["frame"], ot)] = t["player_id"]
            for r in raw_tracks:
                r["canonical_id"] = canon_map.get((r["frame"], r.get("player_id")))
            correct_canonical_swaps(raw_tracks, tracks, calib=calib)
            _smooth_track_positions(raw_tracks, tracks)
            raw_tracks_out.clear()
            raw_tracks_out.extend(raw_tracks)
    if cap is not None:
        cap.release()
    return tracks


def run_ball_detection(
    video_path: Path,
    match_dir: Path,
    *,
    ball_model: Optional[str] = None,
    sample_every_n_frames: int = 1,
    conf: float = 0.2,
    iou: float = 0.5,
    ball_class_id: Optional[int] = None,
) -> Dict[str, Any]:
    """
    Run a dedicated ball YOLO checkpoint on the match video (separate from player weights).

    Returns a dict suitable for ``tracks/ball.json``:
    ``schema_version``, ``model``, ``ball_class_id``, ``detections`` (list of per-hit records).

    Each detection: ``frame``, ``timestamp``, ``bbox_xyxy``, ``confidence``, ``class_id``,
    ``x_pixel``, ``y_pixel``, and optionally ``x_court``, ``y_court`` when homography exists.
    """
    from src.vision.detection.ball_yolo import (
        best_ball_detection,
        bbox_center,
        load_ball_model,
        resolve_ball_model_path,
    )

    resolved = resolve_ball_model_path(ball_model)
    out: Dict[str, Any] = {
        "schema_version": "1",
        "model": None,
        "ball_class_id": ball_class_id,
        "detections": [],
    }
    if not resolved:
        return out

    cid = ball_class_id
    if cid is None and os.getenv("COURTFLOW_BALL_CLASS_ID", "").strip() != "":
        try:
            cid = int(os.environ["COURTFLOW_BALL_CLASS_ID"])
        except ValueError:
            cid = None

    try:
        model = load_ball_model(resolved)
    except Exception:
        return out

    out["model"] = resolved
    out["ball_class_id"] = cid

    calib = None
    try:
        from src.court.calibration.artifacts import load_calibration_artifacts

        calib = load_calibration_artifacts(match_dir / "calibration")
    except Exception:
        calib = None

    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return out
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    total = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)
    frame_idx = 0
    hits: List[dict] = []
    progress_every = max(1, total // max(1, sample_every_n_frames) // 15) if total else 0
    processed = 0

    while True:
        ret, frame = cap.read()
        if not ret or frame is None:
            break
        if frame_idx % sample_every_n_frames != 0:
            frame_idx += 1
            continue
        det = best_ball_detection(frame, model, conf=conf, iou=iou, ball_class_id=cid)
        if det is not None:
            xyxy, conf_val, cls_id = det
            cx, cy = bbox_center(xyxy)
            rec: dict = {
                "frame": frame_idx,
                "timestamp": round(frame_idx / fps, 4) if fps > 0 else 0.0,
                "bbox_xyxy": xyxy,
                "confidence": round(conf_val, 4),
                "class_id": cls_id,
                "x_pixel": round(cx, 2),
                "y_pixel": round(cy, 2),
            }
            if calib is not None:
                try:
                    from src.vision.mapping.img_to_court import pixel_to_court

                    xc, yc = pixel_to_court(cx, cy, calib)
                    rec["x_court"] = round(float(xc), 4)
                    rec["y_court"] = round(float(yc), 4)
                except Exception:
                    pass
            hits.append(rec)
        processed += 1
        if progress_every and processed % progress_every == 0 and total > 0:
            pct = min(100, round(100 * (frame_idx + 1) / total, 1))
            print(f"   ... ball detection frame {frame_idx + 1}/{total} ({pct}%)")
        frame_idx += 1

    cap.release()
    out["detections"] = hits
    return out
