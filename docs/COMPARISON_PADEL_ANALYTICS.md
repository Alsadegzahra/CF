# CourtFlow vs [padel_analytics](https://github.com/Joao-M-Silva/padel_analytics)

This doc compares **[João Miguel Silva’s padel_analytics](https://github.com/Joao-M-Silva/padel_analytics)** with CourtFlow so we can align features and pipeline design.

---

## Player detection & tracking: what they do (and what we took from it)

**Their setup (working):**

- **No re-encode:** They use the video file as-is (no ingest step that transcodes). So the model sees the same pixels as the source.
- **YOLO + supervision:** `YOLO(model_path).predict(..., conf=0.5, iou=0.7, imgsz=640, classes=[0])`, then `sv.Detections.from_ultralytics(result)`.
- **Court filter:** `sv.PolygonZone` from 4 court corners; `polygon_zone.trigger(detections)` keeps only detections inside the court.
- **ByteTrack:** `sv.ByteTrack(frame_rate=video_info.fps)` then `byte_track.update_with_detections(detections)` for stable IDs across frames.
- **Batching:** They run `predict_sample(sample)` on batches of frames (batch_size=8), then update results; same YOLO API we have.

**What we did in CourtFlow:**

- **Default ingest = copy (no re-encode):** We now copy the video as-is by default so detection gets the same input as the source (and as best.pt when you test on the same file). Use `--reencode` only when you need normalized 1920×1080 @ 30 fps. See [DETECTION_AND_TRACKING_OPTIONS.md](DETECTION_AND_TRACKING_OPTIONS.md).
- **Meta stores real fps:** When creating meta we probe the video for fps (and duration) so analytics use the real frame rate instead of assuming 30.
- **Detection + match (no tracker) as default:** We run detection every frame and assign IDs 1–4 by matching to the previous frame (greedy min distance, with max distance cap) so we don’t drop detections the way a tracker can. That gives 4 boxes whenever the model sees 4.
- **Optional tweaks to try (like them):** If you use a tracker, try **conf=0.5, iou=0.7** (they use 0.5/0.7; we default 0.4/0.5). You can also try **ByteTrack from supervision** (`sv.ByteTrack`) instead of Ultralytics’ built-in tracker for consistency with their pipeline; our ROI (court polygon) is already similar to their PolygonZone.

---

## How the two GitHub projects assign player IDs (best practice)

Comparison with **[padel_analytics](https://github.com/Joao-M-Silva/padel_analytics)** and **[DS_Padel](https://github.com/AlvaroNovillo/DS_Padel)**:

| Approach | padel_analytics | DS_Padel | CourtFlow (current) |
|--------|------------------|----------|----------------------|
| **Who keeps IDs stable?** | **ByteTrack** (supervision) | **Ultralytics tracker** (`track(..., persist=True)`) | **Custom match** to previous frame (LAP on distance) |
| **When do we decide “player 1–4”?** | They keep ByteTrack IDs as-is (no fixed 1–4) | **After** full video: pick 4 tracks by “closest to court center in first frame”, then keep only those 4 | **First frame:** assign 1–4 by position (top→bottom, left→right). Then LAP match each new frame to prev. |
| **Court filter** | PolygonZone (in-court only) | Court keypoints → filter to 4 closest to court center in frame 0 | Optional ROI; otherwise top-4 by confidence |

**padel_analytics:**  
- Use **ByteTrack** so IDs are stable across frames.  
- No explicit “canonical 1–4”; they use whatever IDs ByteTrack assigns.  
- Conf 0.5, IOU 0.7, batch predict, then `byte_track.update_with_detections(detections)`.

**DS_Padel:**  
- Use **YOLO `track(frame, persist=True)`** so the built-in tracker gives stable `track_id`s.  
- **Then**, in one pass after all frames: look at **first frame** only, compute each detection’s distance to **court center** (from court keypoints), sort by distance, and **choose the 4 closest** as the four players.  
- For every frame, **filter** to only those 4 track IDs. So “player 1–4” = the 4 tracks that were closest to court center in frame 0.

**Best way to do it (recommendation):**  
1. **Use a tracker** (ByteTrack or Ultralytics) to get stable IDs across the whole video.  
2. **Then** decide who is “1–4” from **one reference frame** (e.g. first frame where all 4 are visible, or first frame overall):  
   - Either by **position** (e.g. sort by (-y, x) like we do), or  
   - By **distance to court center** (like DS_Padel) so the 4 players on court are chosen and others (referee, audience) dropped.  
3. For every frame, keep only those 4 IDs and optionally remap them to 1–4 in a fixed order.

So: **tracker first for stability, then one-shot “pick 4” from the first (or a chosen) frame** is how both reference repos effectively do it. CourtFlow’s “match to previous frame” is a tracker-free alternative; if IDs still swap or thumbnails are wrong, switching to ByteTrack + “pick 4 from first frame (by position or court center)” is the approach used by [padel_analytics](https://github.com/Joao-M-Silva/padel_analytics) and [DS_Padel](https://github.com/AlvaroNovillo/DS_Padel).

---

## Why they don't see "all IDs lost" (and what we did)

**padel_analytics** ([players_tracker.py](https://github.com/Joao-M-Silva/padel_analytics/blob/main/trackers/players_tracker/players_tracker.py)):  
- They **never filter to a fixed set of 4 IDs**. They keep **every** detection ByteTrack returns and use `detection.tracker_id` as-is. When the tracker outputs (1,2,3,4) and later (5,6,7,8) after a reset, they still have 4 people per frame—just different ID numbers.  
- So they **never drop** people. Tradeoff: no fixed "player 1" across the whole video; the same person might be ID 1 then ID 5. Their CSV/analytics can still export position per track_id.

**DS_Padel** ([player_tracker.py](https://github.com/AlvaroNovillo/DS_Padel/blob/main/trackers/player_tracker.py)):  
- They **do** filter to 4 IDs from the first frame (`if key in chosen_player`). So they **would** have the same issue: if the tracker assigns new IDs (5,6,7,8) after a cut, those frames would have **no** players.  
- They likely avoid it with **short or clean videos** (no long cuts) or a stable tracker. They do **not** implement re-anchor.

**CourtFlow:**  
- We want **canonical 1–4** for the report, so we can't just keep raw IDs like padel_analytics.  
- We **re-anchor**: when our chosen 4 disappear for ~30 frames (~1 s), we **re-pick 4** from the next frame that has 4 detections. So we get continuous 1–4 for the whole video, with possible short gaps at segment boundaries.  
- That way we don't drop the rest of the video (unlike DS_Padel) while keeping clear 1–4 for analytics (unlike padel_analytics' raw IDs).

---

## What padel_analytics does

From the repo (Python, fixed camera, 12 keypoints, custom weights):

| Feature | How they do it |
|--------|-----------------|
| **Player position & velocity** | YOLOv8m person detection + tracking; 2D projection to court via homography. |
| **Ball position & velocity** | TrackNet + InpaintNet (custom weights); ball detection/tracking. |
| **2D game projection** | Court keypoints (12 pts) → homography; players + ball drawn on top-down court. |
| **Heatmaps** | From projected positions (part of `ProjectedCourt` / analytics). |
| **Ball velocity per stroke** | From ball tracking + timing (distinct strokes). |
| **Player error rate** | Derived from their analytics (data_analytics.py / projected_court). |
| **Pose (13 DOF)** | Separate model: “players keypoints” (e.g. `best.pt` in weights). |
| **Pose classification** | Backhand/forehand volley, bandeja, topspin smash, etc. (stroke type). |
| **Ball hit prediction** | Model predicts ball hits (for rally/shot logic). |

**Pipeline (main.py):**

1. **Config** – One `config.py`: input video, output video, paths for weights and cache (player det, player keypoints, ball, court keypoints).
2. **Court keypoints** – UI pops up on first frame; user clicks **12 keypoints** in a fixed order (k1–k12: baselines, service line, net). Can load/save from JSON. They use a **polygon zone** (4 corners) from keypoints to filter person detections to the court.
3. **Trackers (run in sequence)**  
   - **PlayerTracker** – YOLOv8m, polygon zone, detections → players.  
   - **PlayerKeypointsTracker** – Pose (13 DOF), separate weights.  
   - **BallTracker** – TrackNet + InpaintNet.  
   - **KeypointsTracker** – Court keypoints (or fixed from click).  
4. **TrackingRunner** – For each frame: run all trackers, then `ProjectedCourt.draw_projections_and_collect_data()` to draw 2D court + collect positions. If `COLLECT_DATA`: aggregate into `DataAnalytics`, then export to **CSV** (frame, player1_x, player1_y, …).
5. **Output** – Annotated video (`results.mp4`) + optional `data.csv` with positions and derived velocity/acceleration (per player, per frame interval).

**12 keypoints layout (from main.py):**

```
k11--------------------k12
|                      |
k8-----------k9--------k10
|     |      |         |
k6----------------------k7
|     |      |         |
k3-----------k4---------k5
|                      |
k1----------------------k2
```

**Tech:** supervision, OpenCV, PyTorch, pandas, tqdm. Weights from Google Drive; 8GB+ VRAM default.

---

## CourtFlow vs padel_analytics (side by side)

| Capability | padel_analytics | CourtFlow |
|------------|-----------------|-----------|
| **Player detection/tracking** | YOLOv8m + polygon zone | YOLO (best.pt or default) + optional ROI, detect+match or tracker |
| **Court calibration** | 12 keypoints (click UI), homography, polygon zone | 4 or 12 points (click or identity), homography, optional ROI |
| **2D court projection** | Yes (ProjectedCourt) | Yes (x_court, y_court from homography) |
| **Heatmaps** | Yes (from projected court) | Yes (combined + per-player), in report + dashboard |
| **Player position/velocity in report** | CSV: x, y, Vx, Vy, distance, acceleration | report.json: distance, avg_speed, max_speed, sprint, accel, lateral %, etc. |
| **Ball detection/tracking** | Yes (TrackNet + InpaintNet) | **No** (stubbed in padel.py) |
| **Ball velocity per stroke** | Yes | **No** (needs ball pipeline) |
| **Player error rate** | Yes | **No** (could add from ball/out events) |
| **Pose (keypoints)** | Yes (13 DOF, separate model) | **No** (TODO in CourtFlow) |
| **Pose classification (stroke type)** | Yes (volley, bandeja, smash, etc.) | **No** |
| **Ball hit prediction** | Yes | **No** |
| **Output** | Video + CSV | Video + report.json + dashboard + optional R2 |
| **Run style** | Single script `main.py`, one video in config | CLI: ingest → run-match (per match), API + dashboard |

---

## How to make CourtFlow “very similar” to padel_analytics

### 1. **Calibration and keypoints (already close)**

- **Them:** 12 keypoints, click UI, save/load JSON, polygon zone from corners.  
- **Us:** 4 or 12 points (see `court_keypoints.py`), click or identity, homography + ROI.  
- **Action:** Document the 12-point order (we have it in `court_keypoints.py`) and add a **keypoint diagram** in the repo (like their main.py lines 24–38) and optionally a short video for “how to click” (like their `select_keypoints.mp4`). No code change required for 12-point support.

### 2. **Single “run one video” entry point (optional)**

- **Them:** Edit `config.py` (input path, output path, weights, cache), run `python main.py`.  
- **Us:** `ingest-match` → `run-match` (match_id from DB).  
- **Action:** Add a small script or CLI mode, e.g. `run-video --input video.mp4 --output-dir out/`, that (1) creates an in-memory or temp match, (2) runs the same pipeline (track → map → report → renders → highlights), (3) writes to `output-dir` (report, heatmaps, overlay video, highlights). That gives a “one video in, one folder out” workflow similar to theirs while keeping the current match-based flow.

### 3. **Ball tracking (biggest gap)**

- **Them:** BallTracker (TrackNet + InpaintNet), ball position/velocity, stroke velocity.  
- **Us:** No ball pipeline; `padel.py` expects future `ball_shot_frames` and `bounce_events`.  
- **Action:** (1) Add a ball detection/tracking stage (e.g. TrackNet-style or another small net; we can keep our pipeline contract: “ball positions per frame” or “ball events”). (2) Write ball positions (and optionally shot/bounce events) into a `ball.json` or into tracks. (3) In `report.py` / `padel.py`, plug ball data into `compute_rally_metrics`, `compute_shot_speeds`, `compute_wall_usage`. (4) Optionally expose “ball velocity per stroke” and “player error rate” in report and dashboard. This is the main enabler for “ball velocity per stroke” and “error rate” like theirs.

### 4. **Pose and stroke classification**

- **Them:** PlayerKeypointsTracker (13 DOF), then pose classification (volley, bandeja, smash, etc.).  
- **Us:** No pose; ground point from bbox bottom.  
- **Action:** (1) Add optional pose stage (e.g. YOLO pose or separate keypoint model) and store keypoints per player per frame. (2) Use keypoints for “ground point” (e.g. ankles) in mapping. (3) Later: add a classifier (or small model) that takes pose/crop and outputs stroke type; add to report (e.g. “stroke_types” or “shot_type” per event). Document as “pose + stroke classification” in FEATURES_CHECKLIST.

### 5. **2D projected court view (visual)**

- **Them:** Draw players and ball on a top-down court in the output video.  
- **Us:** Overlay on original video (bboxes + IDs); we have court coords but don’t draw a 2D court view.  
- **Action:** Add an optional “projected court” render: top-down court (rectangle or template), players (and later ball) as points/circles from (x_court, y_court), either as a separate video or as a picture-in-picture in the overlay video. Reuse our homography and existing court dimensions.

### 6. **Data export (CSV / dataframe)**

- **Them:** `DataAnalytics.into_dataframe(fps)` → CSV with frame, player1_x, player1_y, …, velocities, accelerations.  
- **Us:** report.json + tracks.json (and dashboard).  
- **Action:** Add a small export (e.g. `export-tracks-csv` or a function in analytics) that, from `tracks.json` + report, produces a CSV similar to theirs: frame, time, player1_x, player1_y, … player4_x, player4_y, and optionally distance/velocity columns. That helps coaches or analysts who prefer spreadsheets.

### 7. **Config and weights in one place**

- **Them:** Single `config.py` with paths for video, weights, cache.  
- **Us:** CLI args + `models/` (e.g. best.pt), env for R2, settings in code.  
- **Action:** Add a small `config.py` or `config.yaml` at project root (or under `src/config/`) for: input/output paths (when using “run one video” mode), detection model path, optional ball/pose model paths, court dimensions. Keeps “one place to edit” for runs similar to theirs.

---

## Suggested order to align with padel_analytics

1. **Document 12-point calibration** – Diagram + optional short video; no new code.  
2. **Optional “run one video” script** – Single entry point: one video → one output dir (report, heatmaps, overlay, highlights).  
3. **2D projected court render** – Optional video or image: top-down court + players (and later ball).  
4. **CSV export** – From tracks + report → CSV (frame, positions, optional velocity/distance).  
5. **Ball pipeline** – Detect/track ball, write events, plug into padel analytics (rally, shot speed, wall, error rate).  
6. **Pose** – Keypoints for better ground point and future stroke classification.  
7. **Stroke classification** – After pose: volley, bandeja, smash, etc., and expose in report.

This order gets you “same kind of outputs” (court view, CSV, heatmaps, report) quickly, then adds the heavier pieces (ball, pose, stroke type) so CourtFlow ends up very close to what [padel_analytics](https://github.com/Joao-M-Silva/padel_analytics) offers.
