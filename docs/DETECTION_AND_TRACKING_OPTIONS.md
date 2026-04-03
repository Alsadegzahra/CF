# Detection and tracking options (maintain with best.pt)

This doc describes options that keep the **pipeline output in line with running your detection model (e.g. best.pt) alone**. Use it when results in CourtFlow don’t match what you see when testing the model directly, and to keep this behavior maintainable.

---

## 1. Ingest: copy vs re-encode (default: copy)

**Default behavior:** Ingest **copies** the video as-is (no re-encode). Same resolution/fps as source, so detection/tracking sees the same pixels as your model at training time. Faster ingest, no quality loss, and scalable long-term (no transcoding).

**If you need normalized playback (e.g. 1920×1080 @ 30 fps):** Use **`--reencode`** so the file is re-encoded. Use when you want consistent resolution across all matches for playback or when calibration was done on a fixed resolution.

**Usage (default = copy):**

```bash
python3 -m src.app.cli ingest-match --court_id court_001 --input sample_videos/sample.mp4
```

**Why we default to copy (no re-encode):**

- **Detection/tracking:** Re-encoding changes resolution and can change aspect ratio or crop; the model then sees different pixels than the original (or training) video. Copy keeps input identical to source (and to best.pt when you test on the same file).
- **Long-term:** Re-encoding is CPU-heavy and doesn’t scale (transcoding farm, delay). Copy is fast and cheap.
- **Pipeline:** Calibration and homography use per-video resolution (image_width, image_height); meta stores probed fps and duration from the file. So the pipeline does not assume 1920×1080 or 30 fps.

**Where it lives:**

- **CLI:** `ingest-match` (default copy); `ingest-match --reencode` to re-encode (see `src/app/cli.py`)
- **Ingest:** `ingest_file_to_mp4(..., copy_only=True)` by default in `src/video/ingest.py`

**Maintenance:** Default is copy; keep `--reencode` and `copy_only=False` for the re-encode path. Document here and in help text.

---

## 2. What we do for tracking (BoT-SORT + canonical P1–P4)

**Detection** gives boxes every frame (your best.pt). **Tracking** is two steps: (1) **BoT-SORT** assigns a persistent tracker ID to each person across frames; (2) **Canonicalize** picks the first frame with ≥4 tracker IDs, maps 4 of them to P1–P4 (by court position), and re-anchors when those 4 disappear for ~60 frames. **Overlay:** Every detection gets a box. If its tracker ID is one of our chosen 4, we show **P1–P4**; otherwise **?**. **Why you see "?"** We map the 4 tracker IDs at anchor frames to P1–P4 and **re-anchor** when the current 4 change, so "?" is rare. **Same kit:** We auto-detect (high swap rate) and re-run with **ByteTrack** (no ReID; often fewer ID switches than BoT-SORT without ReID). We also **post-correct** swaps: when two players' positions suggest they swapped labels between consecutive frames, we flip the labels so IDs stay consistent. Same-kit configs use stricter **match_thresh** and lower **track_buffer** to reduce wrong re-associations (see Ultralytics tracker docs). You can force **`--same-kit`** or **`--tracker config/trackers/bytetrack_padel_same_kit.yaml`** to skip the first ReID pass.



## 3. Detection-only (IDs by position, full pipeline and insights)

**Use case:** Run the **entire pipeline without a tracker**: detect persons each frame, assign P1–P4 by position (e.g. sort by image position), then run mapping, report, heatmaps, overlays, and highlights as usual. Use this when you want to avoid tracker dependencies or when tracking is unreliable and you still want insights.

**Full pipeline with detection-only:** All stages after detection run as normal:
- **Stage 02** – Detection only: 4 boxes per frame, P1–P4 by position (IDs can jump when players cross).
- **Stage 03** – Coordinate mapping: pixel → court (same as with tracking).
- **Stage 04** – Analytics report: total distance, per-“player” distance, heatmaps, zone coverage, intensity, highlights (same metrics).
- **Stage 05** – Overlay video and sample images (P1–P4 on each frame).
- **Stage 06** – Export highlights clip.

**Caveat:** Because there is no tracking, P1–P4 are **by court position each frame**, not by stable identity. So “P1” in the report is the aggregate of whoever was in position 1 in each frame (possibly many different people). Distance, heatmap, and zone stats for P1–P4 are still meaningful as “slot” or “role” stats (e.g. left court vs right court) but not as “same person over time.” The report includes `"tracking_mode": "detection_only"` when run with `--detection-only` so dashboards can show a short disclaimer.

**Usage:**

```bash
python3 -m src.app.cli run-match --match_id <id> --detection-only
```

**Where it lives:**

- **CLI:** `run-match --detection-only`
- **Pipeline:** `run_tracking(..., detection_only=True)` in `src/vision/pipeline.py` → assigns 1–4 by position each frame (no tracker)
- **Stages / runner:** `stage_02_track(..., detection_only=...)`, `run_match(..., track_detection_only=...)`; stages 03–06 run unchanged
- **Report:** `build_phase1_report(..., detection_only=...)` sets `report["tracking_mode"]` for UI

---

## 3. BoT-SORT: reducing disconnects and “no ID” frames

**How we run it:** We call **`model.track(source=video_path, stream=True)`** (one run for the whole video) so Ultralytics keeps tracker state correctly. See [Ultralytics Track mode](https://docs.ultralytics.com/modes/track/). Config: `config/trackers/botsort_padel.yaml` — **BoT-SORT with ReID** (`with_reid: True`, `model: auto` uses detector features, no extra model). **track_buffer** 180 (~6 s) so when a player is lost (e.g. near the door) we keep the track alive and ReID re-associates by appearance when they reappear, reducing ID swaps.

**Keep tracking dense:** Use **`--sample_every 1`** (default). Skipping frames can make the tracker lose people.

**If many "?" or IDs drop often:** Try **ByteTrack** first (often fewer ID switches and less P1/P2 swap): `--tracker config/trackers/bytetrack_padel.yaml` or `--tracker bytetrack.yaml`. Also try `--skip-first-seconds 2`; lower `--conf 0.15`; or tune the tracker yaml. For BoT-SORT, **ReID** (`with_reid: True`) can help across occlusions.

---

## 3b. No boxes at all = detection issue (best.pt)

**We use `models/best.pt`** when it exists (else pretrained YOLO). If you often see **no boxes** on the overlay, the detector isn’t returning any person above the confidence threshold for those frames.

**Quick fix:** Default conf is **0.2**. Try lower if many frames still have no boxes:
```bash
python3 -m src.app.cli run-match --match_id <id> --conf 0.15
```
Lower conf = more detections (fewer “no box” frames), with more risk of false positives; the tracker and re-anchor still keep 4 players.

**Longer-term:** If you still get many empty frames at 0.15, improve the model: fine-tune or train best.pt on more data (similar resolution, angle, lighting), or try a larger backbone (e.g. yolov8m) if you have the GPU.

---

## 3c. Pose refinement (optional ground point + skeleton on video)

Use **`--pose`** to refine the player ground point with a pose model (Ultralytics YOLO-pose, e.g. yolov8n-pose.pt). Pose runs **per frame right after detection** (in the same pass as tracking): for each frame we get detections from the tracker, run pose on each person crop, then attach ground point (ankles/knees) and keypoints to that frame’s tracks. So there is no second video pass; pose is “after detection, before we store tracks.” The tracker’s own association (ByteTrack/BoT-SORT) does not use pose—using pose inside association would require custom tracker code; for now pose improves ground point, overlay skeleton, and is available for future pose-based checks.

**Pose on the overlay video:** When you use `--pose`, the track overlay video (`renders/track_overlay_preview.mp4`) and sample PNGs also draw the **pose skeleton** (COCO 17 keypoints) on each player in cyan.

```bash
python3 -m src.app.cli run-match --match_id <id> --pose
```
The pose model is downloaded on first use (yolov8n-pose.pt). Tracking and canonical IDs are unchanged; the ground point used for court mapping is refined, and the overlay shows the skeleton when pose data is available.

---

## 4. Court ROI (optional)

**Default:** The pipeline does **not** use court ROI (use_roi=False). It keeps the top 4 detections by confidence per frame so the 4th player is not cut off when the court polygon (from calibration) doesn’t match this video’s angle.

**If your calibration matches this video and you want to restrict to the court:** Run with **`--roi`** so detections outside the court polygon are filtered out.

**Usage:**

```bash
python3 -m src.app.cli run-match          # default: no ROI, top 4 by confidence
python3 -m src.app.cli run-match --roi   # filter by court polygon
```

**Where it lives:**

- **CLI:** `run-match` (default no ROI); `run-match --roi` to enable
- **Pipeline:** `run_tracking(..., use_roi=False)` by default in `src/vision/pipeline.py` → top 4 by confidence; use_roi=True → filter by court polygon

---

## Quick reference: “Same as best.pt alone”

To have the pipeline match what you see when testing best.pt on the same file:

1. **Ingest** with default (copy as-is) so the file is identical to best.pt input.
2. **Run** with default (no ROI; use `--roi` only if your court polygon matches this video).

```bash
python3 -m src.app.cli ingest-match --court_id court_001 --input sample_videos/sample.mp4
python3 -m src.app.cli run-match
```

---

## 5. Only 3 players detected (4th missing in some frames)

**Symptom:** Overlay shows P1, P2, P3 (or P1, P2, P4) but the 4th visible player has no box.

**Causes:** Either (1) the detector (best.pt) doesn’t output a 4th box in those frames (e.g. player small, occluded, or below confidence), or (2) the tracker assigns `track_id < 0` to the 4th and we drop it.

**Try in order:**

1. **Default conf is 0.2** so the 4th player (often smaller in frame) is kept. If you get too many false positives, raise it:
   ```bash
   python3 -m src.app.cli run-match --match_id <id> --conf 0.4
   ```

2. **Detection-only** if you prefer all 4 boxes (IDs may switch frame-to-frame):
   ```bash
   python3 -m src.app.cli run-match --match_id <id> --detection-only
   ```

3. **Default is no court ROI** so no player is cut off by the polygon. If your calibration matches this video, you can add `--roi` to filter to the court.

4. If still max 3: add more training data for that angle/size or keep a lower `--conf`.

---

## 6. Improve tracking (what we did and what’s left)

**Done (aligned with Ultralytics):**
- **Video-source tracking:** We run `model.track(source=video_path, stream=True)` so the tracker sees the whole video in one run and state is correct. Same as the [official Track mode](https://docs.ultralytics.com/modes/track/).
- **BoT-SORT with ReID:** Default config `botsort_padel.yaml` has `with_reid: True` and `model: auto` (detector features only, no extra model). This helps when a player is lost then reappears (e.g. near the door) — we keep the track alive longer (track_buffer 180) and ReID re-associates by appearance to reduce swaps. Not more complex to use; just the default. If you need to disable ReID (e.g. speed), set `with_reid: False` in the yaml.

**If P1–P4 are still unstable (IDs lost or P1/P2 swapped):**
- **Use ByteTrack:** Often fewer ID switches than BoT-SORT. Run: `python3 -m src.app.cli run-match --match_id <id> --tracker config/trackers/bytetrack_padel.yaml` (padel-tuned) or `--tracker bytetrack.yaml` (Ultralytics default).
- Enable **ReID** in `config/trackers/botsort_padel.yaml`: set `with_reid: True` (needs extra compute; can use `model: auto` for detector features).
- Use **`--detection-only`** if you prefer 4 boxes every frame with P1–P4 by position (IDs can jump when players cross).

**ReID after occlusion:** When a player is lost for many frames (long occlusion), default BoT-SORT can assign a new ID because both IoU and embedding are poor. We apply a patch so that when IoU is bad we use **ReID-only** for association and can re-attach the same track. See **`docs/TRACKING_REID_NOTES.md`** for details and references.

**Which tracker we use:** Default is **ByteTrack** (`config/trackers/bytetrack_padel.yaml`), same approach as [padel_analytics](https://github.com/Joao-M-Silva/padel_analytics) and [DS_Padel](https://github.com/AlvaroNovillo/DS_Padel): no ReID, stable IDs, first-frame pick of 4 players. We apply **EMA smoothing** to positions and boxes to reduce jitter. Use **BoT-SORT with ReID** only when needed: `--tracker config/trackers/botsort_padel.yaml`. For same-kit (high swap rate) we can re-run with ByteTrack; see [Ultralytics discussion #20699](https://github.com/orgs/ultralytics/discussions/20699) for low FPS / parameter tuning.

---

## Related

- **ReID and occlusion:** `docs/TRACKING_REID_NOTES.md`
- **Custom model:** `models/README.md`, `docs/DETECTION_TRAINING.md`
- **Pipeline flow:** `docs/CONTRACTS_AND_STRUCTURES.md`
- **Vision layer:** `docs/INTELLIGENCE.md`, `src/vision/pipeline.py`
