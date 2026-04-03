"""
Stage functions: calibration, track, map, report, renders, highlights.
Uses: court/calibration, vision (stubs), storage/tracks_db, analytics/report, highlights/export, video/clips, utils/io.
"""
from __future__ import annotations

from pathlib import Path
from typing import Any, Dict, List, Optional

from src.utils.io import read_json, write_json
from src.utils.time import now_iso
from src.domain.models import CalibrationHomography
from src.court.calibration.artifacts import load_calibration_artifacts
from src.analytics.report import build_phase1_report
from src.highlights.export import export_highlights
from src.video.clips import probe_duration, probe_fps


def _meta_path(match_dir: Path) -> Path:
    return match_dir / "meta" / "meta.json"


def _report_path(match_dir: Path) -> Path:
    return match_dir / "reports" / "report.json"


def ensure_meta_and_report(match_dir: Path, video_path: Path) -> None:
    """Ensure meta/meta.json and reports/report.json exist."""
    meta_path = _meta_path(match_dir)
    report_path = _report_path(match_dir)
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    if not meta_path.exists():
        duration = probe_duration(video_path) if video_path.exists() else 0.0
        fps = probe_fps(video_path) if video_path.exists() else 30.0
        write_json(meta_path, {
            "status": "created",
            "created_at": now_iso(),
            "last_updated_at": now_iso(),
            "video_path": str(video_path),
            "video": {"duration_seconds": duration, "fps": fps},
        })
    if not report_path.exists():
        write_json(report_path, {"created_at": now_iso(), "highlights": []})


def update_meta_status(match_dir: Path, status: str) -> None:
    meta = read_json(_meta_path(match_dir))
    meta["status"] = status
    meta["last_updated_at"] = now_iso()
    write_json(_meta_path(match_dir), meta)


def stage_01_load_calibration(match_dir: Path, court_id: str, video_path: Path) -> None:
    """
    Per-match calibration flow: manual once per court, then light auto-check per match.
    If check fails → try auto-fix; if that fails → proceed without court mapping (manual later).
    """
    from src.domain.enums import CalibrationStatus
    from src.court.calibration.quick_check import run_quick_check
    from src.court.calibration.artifacts import save_calibration_artifacts
    from src.court.calibration.auto_fix import try_auto_fix
    from src.pipeline.paths import court_calibration_dir

    calib_dir = court_calibration_dir(court_id)
    calib = load_calibration_artifacts(calib_dir)

    if not calib:
        print("   No calibration for this court; trying auto-detect from video...")
        new_calib = try_auto_fix(court_id, video_path)
        if new_calib:
            save_calibration_artifacts(calib_dir, new_calib)
            calib = new_calib
            print("   ✓ Auto-detect applied; calibration saved.")
        else:
            print("   Auto-detect failed; run manual calibration once per court.")
            return

    # Light per-match check
    status = run_quick_check(court_id, video_path=video_path)
    if status == CalibrationStatus.OK:
        print(f"   ✓ Calibration OK for court {court_id}")
    elif status == CalibrationStatus.WARN:
        # Show why: calibration was saved for a different resolution than this video
        try:
            import cv2
            cap = cv2.VideoCapture(str(video_path))
            ok, frame = cap.read()
            cap.release()
            if ok and frame is not None:
                h, w = frame.shape[:2]
                print(f"   ⚠ Calibration was saved for {calib.image_width}×{calib.image_height}; this video is {w}×{h}. Using anyway.")
            else:
                print(f"   ⚠ Calibration warn (e.g. resolution mismatch) for court {court_id}; using anyway.")
        except Exception:
            print(f"   ⚠ Calibration warn (e.g. resolution mismatch) for court {court_id}; using anyway.")

    if status == CalibrationStatus.FAIL:
        print("   Calibration check failed; trying auto-fix...")
        new_calib = try_auto_fix(court_id, video_path)
        if new_calib:
            save_calibration_artifacts(calib_dir, new_calib)
            calib = new_calib
            print("   ✓ Auto-fix applied; calibration updated.")
        else:
            print("   Auto-fix did not recover calibration; run manual calibration. Proceeding without court mapping.")
            return

    # Copy to match dir so stage 03/04 find it
    match_calib_dir = match_dir / "calibration"
    match_calib_dir.mkdir(parents=True, exist_ok=True)
    from src.court.calibration.homography import save_homography
    save_homography(match_calib_dir / "homography.json", calib)


# Swap rate above this → likely same kit; re-run tracking without ReID
_SWAP_RATE_SAME_KIT_THRESHOLD = 0.04


def stage_02_track(
    match_dir: Path,
    video_path: Path,
    court_id: str,
    *,
    sample_every_n_frames: int = 1,
    conf: float = 0.2,
    iou: float = 0.5,
    tracker: Optional[str] = None,
    detection_model: Optional[str] = None,
    use_roi: bool = False,
    detection_only: bool = False,
    skip_first_seconds: float = 0.0,
    use_pose: bool = False,
) -> None:
    """Player detection + tracking -> tracks/tracks.json. Delegates to vision.pipeline (intelligence layer)."""
    from src.utils.io import write_json_atomic_any
    from src.vision.pipeline import run_tracking, estimate_canonical_swap_rate

    tracks_dir = match_dir / "tracks"
    tracks_dir.mkdir(parents=True, exist_ok=True)
    tracks_file = tracks_dir / "tracks.json"

    if not video_path.exists():
        write_json(tracks_file, [])
        print("   (skip) Video not found; empty tracks.")
        return

    raw_tracks: List[dict] = []
    tracks = run_tracking(
        video_path, court_id, match_dir,
        sample_every_n_frames=sample_every_n_frames,
        conf=conf,
        iou=iou,
        tracker=tracker,
        detection_model=detection_model,
        use_roi=use_roi,
        detection_only=detection_only,
        skip_first_seconds=skip_first_seconds,
        raw_tracks_out=raw_tracks,
        use_pose=use_pose,
    )
    # If user didn't set tracker and we ran with ReID, check for high swap rate (same kit)
    if not detection_only and tracker is None and raw_tracks:
        swap_rate = estimate_canonical_swap_rate(raw_tracks)
        if swap_rate >= _SWAP_RATE_SAME_KIT_THRESHOLD:
            # ByteTrack often has fewer ID switches than BoT-SORT when ReID is off (benchmarks)
            same_kit_cfg = Path(__file__).resolve().parents[2] / "config" / "trackers" / "bytetrack_padel_same_kit.yaml"
            if not same_kit_cfg.exists():
                same_kit_cfg = Path(__file__).resolve().parents[2] / "config" / "trackers" / "botsort_padel_same_kit.yaml"
            if same_kit_cfg.exists():
                print(f"   High ID swap rate ({swap_rate:.2%}) — likely same kit; re-running with ByteTrack (no ReID)...")
                raw_tracks = []
                tracks = run_tracking(
                    video_path, court_id, match_dir,
                    sample_every_n_frames=sample_every_n_frames,
                    conf=conf,
                    iou=iou,
                    tracker=str(same_kit_cfg),
                    detection_model=detection_model,
                    use_roi=use_roi,
                    detection_only=False,
                    skip_first_seconds=skip_first_seconds,
                    raw_tracks_out=raw_tracks,
                    use_pose=use_pose,
                )
    write_json_atomic_any(tracks_file, tracks)
    if raw_tracks:
        write_json_atomic_any(tracks_dir / "tracks_raw.json", raw_tracks)
    if not tracks:
        print("   (skip) Vision deps missing (pip install ultralytics) or no detections; empty tracks.")
    else:
        n_players = len(set(t["player_id"] for t in tracks))
        n_frames = len(set(t["frame"] for t in tracks))
        print(f"   ✓ Tracked {len(tracks)} points from {n_frames} frames ({n_players} players).")


def stage_03_map(match_dir: Path, court_id: str) -> None:
    """Pixel -> court mapping: load tracks + calibration, fill x_court/y_court, write back."""
    from src.utils.io import write_json_atomic_any
    tracks_path = match_dir / "tracks" / "tracks.json"
    calib_path = match_dir / "calibration" / "homography.json"
    if not calib_path.exists():
        from src.pipeline.paths import court_calibration_dir
        cal_dir = court_calibration_dir(court_id)
        calib_path = cal_dir / "homography.json"
    if not calib_path.exists() or not tracks_path.exists():
        print("   (skip) No calibration or tracks for coordinate mapping.")
        return
    calib = load_calibration_artifacts(calib_path.parent)
    if not calib:
        print("   (skip) Could not load calibration for mapping.")
        return
    tracks_data = read_json(tracks_path)
    if not isinstance(tracks_data, list) or not tracks_data:
        print("   (skip) No tracks to map.")
        return
    from src.vision.mapping.img_to_court import apply_calibration_to_tracks
    apply_calibration_to_tracks(tracks_data, calib)
    write_json_atomic_any(tracks_path, tracks_data)
    print(f"   ✓ Mapped {len(tracks_data)} track points to court coordinates.")


def stage_04_report(match_dir: Path, match: Dict[str, Any], *, detection_only: bool = False) -> None:
    """Build Phase1Report -> reports/report.json."""
    meta = read_json(_meta_path(match_dir))
    video_meta = meta.get("video", {})
    tracks_path = match_dir / "tracks" / "tracks.json"
    calib_path = match_dir / "calibration" / "homography.json"
    if not calib_path.exists():
        from src.pipeline.paths import court_calibration_dir
        cal_dir = court_calibration_dir(match["court_id"])
        homography_file = cal_dir / "homography.json"
        calib_path = homography_file if homography_file.exists() else None
    report_path = build_phase1_report(
        match,
        video_meta=video_meta,
        tracks_path=tracks_path if tracks_path.exists() else None,
        calib_path=calib_path,
        out_dir=match_dir,
        detection_only=detection_only,
    )
    print(f"   ✓ Report written: {report_path}")


def _write_player_thumbnails(video_path: Path, tracks: List[dict], renders_dir: Path) -> None:
    """
    Write one thumbnail per player (P1..P4) from a representative crop.
    Use 4 sections of the video (0–25%, 25–50%, 50–75%, 75–100%) so each player
    gets a crop from a different part of the match, avoiding repeated thumbnails.
    Within each section pick the track with largest bbox area; skip (frame, bbox) already used.
    """
    import cv2
    if not tracks:
        return
    frames_sorted = sorted(set(t.get("frame") for t in tracks if t.get("frame") is not None))
    n_frames = len(frames_sorted)
    if n_frames == 0:
        return
    # Section boundaries (frame indices): 4 roughly equal segments
    section_boundaries = [
        (0, max(1, n_frames // 4)),
        (max(1, n_frames // 4), max(1, n_frames // 2)),
        (max(1, n_frames // 2), max(1, 3 * n_frames // 4)),
        (max(1, 3 * n_frames // 4), n_frames),
    ]
    by_player: Dict[int, List[dict]] = {}
    for t in tracks:
        pid = t.get("player_id")
        bbox = t.get("bbox_xyxy")
        if pid is None or not bbox or len(bbox) != 4:
            continue
        by_player.setdefault(int(pid), []).append(t)

    def area(t: dict) -> float:
        b = t.get("bbox_xyxy") or [0, 0, 0, 0]
        return (b[2] - b[0]) * (b[3] - b[1])

    def frame_to_section_idx(frame: int) -> int:
        try:
            idx = frames_sorted.index(frame)
        except ValueError:
            idx = 0
        for si, (lo, hi) in enumerate(section_boundaries):
            if lo <= idx < hi:
                return si
        return 0

    # For each player, prefer tracks in that player's "section" (P1→section 0, P2→1, P3→2, P4→3)
    used_fbbox: set = set()  # (frame, x1, y1, x2, y2) rounded to avoid duplicate crops
    thumb_size = (120, 160)
    pad_ratio = 0.25
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        return
    for pid in [1, 2, 3, 4]:
        list_t = by_player.get(pid, [])
        if not list_t:
            continue
        section_idx = (pid - 1) % 4
        lo, hi = section_boundaries[section_idx]
        section_frames = set(frames_sorted[i] for i in range(lo, min(hi, len(frames_sorted))))
        in_section = [t for t in list_t if t.get("frame") in section_frames]
        if not in_section:
            in_section = list_t
        # Sort by area desc, then pick first whose (frame, bbox) not already used
        candidates = sorted(in_section, key=area, reverse=True)
        best = None
        for t in candidates:
            f, b = t.get("frame"), t.get("bbox_xyxy") or [0, 0, 0, 0]
            key = (f, int(b[0]), int(b[1]), int(b[2]), int(b[3]))
            if key not in used_fbbox:
                best = t
                used_fbbox.add(key)
                break
        if best is None:
            best = candidates[0]
            b_best = best.get("bbox_xyxy") or [0, 0, 0, 0]
            used_fbbox.add((best.get("frame"), int(b_best[0]), int(b_best[1]), int(b_best[2]), int(b_best[3])))
        frame_idx = best.get("frame", 0)
        bbox = best.get("bbox_xyxy", [0, 0, 0, 0])
        x1, y1, x2, y2 = [int(round(x)) for x in bbox]
        cap.set(cv2.CAP_PROP_POS_FRAMES, frame_idx)
        ret, frame = cap.read()
        if not ret or frame is None:
            continue
        h_img, w_img = frame.shape[:2]
        w_bb, h_bb = max(1, x2 - x1), max(1, y2 - y1)
        pad_w = max(int(w_bb * pad_ratio), 20)
        pad_h = max(int(h_bb * pad_ratio), 20)
        x1 = max(0, x1 - pad_w)
        y1 = max(0, y1 - pad_h)
        x2 = min(w_img, x2 + pad_w)
        y2 = min(h_img, y2 + pad_h)
        crop = frame[y1:y2, x1:x2]
        if crop.size == 0:
            continue
        thumb = cv2.resize(crop, thumb_size, interpolation=cv2.INTER_AREA)
        out_path = renders_dir / f"player_{pid}_thumb.jpg"
        cv2.imwrite(str(out_path), thumb)
    cap.release()


def stage_05_renders(match_dir: Path, video_path: Path) -> None:
    """Render detection/tracking overlays: sample PNGs + short overlay video."""
    import cv2
    from src.utils.io import read_json
    from src.video.overlay import draw_tracks_on_frame, group_tracks_by_frame

    renders_dir = match_dir / "renders"
    renders_dir.mkdir(parents=True, exist_ok=True)
    tracks_path = match_dir / "tracks" / "tracks.json"
    raw_path = match_dir / "tracks" / "tracks_raw.json"
    if not video_path.exists():
        print("   (skip) No video for renders.")
        return
    # Use raw tracks for overlay when present (box per detection, ID or "?" when no id)
    if raw_path.exists():
        tracks_for_overlay = read_json(raw_path)
    elif tracks_path.exists():
        tracks_for_overlay = read_json(tracks_path)
    else:
        print("   (skip) No tracks or video for renders.")
        return
    if not isinstance(tracks_for_overlay, list) or not tracks_for_overlay:
        print("   (skip) Empty tracks; no overlays.")
        return
    by_frame = group_tracks_by_frame(tracks_for_overlay)
    frame_indices = sorted(by_frame.keys())
    # Player thumbnails: one crop per player (1..4) for dashboard (use canonical tracks)
    if tracks_path.exists():
        tracks_canonical = read_json(tracks_path)
        if isinstance(tracks_canonical, list) and tracks_canonical:
            _write_player_thumbnails(video_path, tracks_canonical, renders_dir)
    if not frame_indices:
        print("   (skip) No track frames.")
        return

    cap = cv2.VideoCapture(str(video_path))
    n_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 0)

    # Sample images: up to 5 frames spread across the video
    samples = []
    for i in [0, 0.25, 0.5, 0.75, 1.0]:
        idx = frame_indices[min(int(len(frame_indices) * i), len(frame_indices) - 1)]
        samples.append(idx)
    samples = sorted(set(samples))
    for fi in samples:
        cap.set(cv2.CAP_PROP_POS_FRAMES, fi)
        ret, frame = cap.read()
        if not ret or frame is None:
            continue
        tr = by_frame.get(fi, [])
        out = draw_tracks_on_frame(frame, tr)
        png_path = renders_dir / f"track_overlay_frame_{fi:05d}.png"
        cv2.imwrite(str(png_path), out)
    print(f"   ✓ Wrote {len(samples)} sample images to renders/")

    # Overlay video: start from first frame that has tracks so boxes are visible from the start
    fps = cap.get(cv2.CAP_PROP_FPS) or 30.0
    w = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    h = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    start_frame = frame_indices[0] if frame_indices else 0
    max_overlay_frames = min(int(60 * fps), n_frames - start_frame)  # up to 60 sec from first track
    if max_overlay_frames <= 0:
        cap.release()
        print("   (skip) No overlay frames after first track.")
        return
    cap.set(cv2.CAP_PROP_POS_FRAMES, start_frame)
    out_video = renders_dir / "track_overlay_preview.mp4"
    writer = cv2.VideoWriter(
        str(out_video),
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps,
        (w, h),
    )
    for i in range(max_overlay_frames):
        ret, frame = cap.read()
        if not ret or frame is None:
            break
        frame_idx = start_frame + i
        tr = by_frame.get(frame_idx, [])
        out = draw_tracks_on_frame(frame, tr)
        writer.write(out)
    writer.release()
    cap.release()
    print(f"   ✓ Wrote overlay video: renders/track_overlay_preview.mp4 ({max_overlay_frames} frames, from frame {start_frame})")


def stage_06_highlights(
    match_dir: Path,
    video_path: Path,
    *,
    clip_len_s: float = 12.0,
    every_s: float = 60.0,
    max_clips: int = 10,
) -> Path:
    """Export highlight clips and concat to highlights/highlights.mp4."""
    report_path = _report_path(match_dir)
    return export_highlights(
        match_dir,
        video_path,
        report_path,
        clip_len_s=clip_len_s,
        every_s=every_s,
        max_clips=max_clips,
    )
