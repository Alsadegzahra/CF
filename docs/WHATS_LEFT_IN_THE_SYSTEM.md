# What’s left to do in the whole system

High-level view of what exists today and what’s left for pilot / launch.

---

## What’s in the system today (done)

| Area | What exists |
|------|-------------|
| **CLI** | `ingest-match`, `run-match`, `calibrate-court`, `upload-match` (R2). |
| **Pipeline (6 stages)** | 01 Load calibration → 02 Detect & track (ByteTrack + smoothing) → 03 Map to court → 04 Report + heatmap → 05 Renders (overlay video, sample PNGs) → 06 Highlights export. |
| **Detection** | YOLO person detection; custom `best.pt` in `models/` supported. |
| **Tracking** | ByteTrack default; BoT-SORT optional; canonical P1–P4; position/box smoothing. |
| **Calibration** | Court homography + ROI; click-based calibration; artifacts in `data/courts/<court_id>/calibration/`. |
| **Analytics** | Report (summary, per-player distance/duration/speed), all-players heatmap. |
| **Outputs** | `tracks.json`, `tracks_raw.json`, `report.json`, `heatmap.png`, overlay video, highlights MP4 + clips. |
| **API (FastAPI)** | Matches, report, artifacts, cloud URLs; serves **user dashboard** at `/view?match_id=xxx`. |
| **User dashboard (web)** | `/view` — report, heatmap, highlights video, player cards; shareable link (needs R2 for cloud URLs). |
| **Ops dashboard (Streamlit)** | `streamlit run dashboard/app.py` — list matches, view report, heatmap, highlights, source video, meta, full report JSON. |
| **Cloud** | R2 upload (highlights, report, heatmap); presigned links for dashboard. |

So: **end-to-end flow is there** (ingest → track → report → heatmap → highlights → dashboard). Good enough for a pilot.

---

## What’s left (by priority)

### 1. Dashboard (for pilot)

| Item | Status | Notes |
|------|--------|--------|
| **User dashboard `/view`** | Exists | Report, heatmap, highlights; works when R2 is set and match is uploaded. |
| **Ops dashboard (Streamlit)** | Exists | Full match viewer; Court ID + Match ID; highlights, analytics, source video. |
| **Polish for pilot** | Optional | Landing page, copy, “no match” state, mobile layout. No new features strictly required. |
| **Dashboard API (separate)** | TODO (low) | `cloud/api/dashboard_api.py` — optional separate FastAPI for dashboard-only deployment. |

**Verdict:** Dashboard is usable for pilot. You can run the API, open `/view?match_id=...` or the Streamlit app, and show report + heatmap + highlights. What’s “left” is mainly polish and optional separate dashboard API.

---

### 2. Product / pipeline (for pilot)

| Item | Status | Notes |
|------|--------|-------|
| **Ball tracking** | Not implemented | Ball detection/tracking and shot events are out of scope for current pilot (see [TODO_CODE.md](TODO_CODE.md)). |
| **Per-player heatmap** | Spec / TODO | [HEATMAP_PER_PLAYER.md](HEATMAP_PER_PLAYER.md) — current heatmap is all-players. |
| **Padel-specific analytics** | Stubbed | Rally metrics, shot speeds, wall usage in `padel.py` depend on ball; can stay stubbed for pilot. |
| **Tracks DB** | TODO | Pipeline uses `tracks.json`; SQLite schema in `tracks_db.py` not implemented. Not required for pilot. |

**Verdict:** For pilot you don’t need ball, per-player heatmap, or tracks DB. Run pipeline as-is and collect data.

---

### 3. Calibration & vision (tune as needed)

| Item | Status | Notes |
|------|--------|-------|
| **Calibration capture** | TODO | `court/calibration/capture.py` — capture frames to calib dir; you can use current click flow. |
| **Auto-fix when check fails** | TODO | Court line detection + homography when quick check fails. |
| **Lens distortion** | TODO (low) | Optional undistort. |
| **Detection/tracking tuning** | Ongoing | Use your data post-pilot to train `best.pt`; tune tracker if needed. |

**Verdict:** Calibration and detection/tracking are “tune as you go.” Not blockers for starting the pilot.

---

### 4. Testing & ops

| Item | Status | Notes |
|------|--------|-------|
| **Unit tests** | TODO | Domain, vision contract, analytics (see [TODO_CODE.md](TODO_CODE.md)). |
| **Integration test** | TODO | One end-to-end: ingest + run-match on fixture video. |
| **CI** | Optional | GitHub Actions (or similar) to run tests/lint. |

**Verdict:** Nice to have for stability; not required to start the pilot.

---

### 5. Deploy & launch

| Item | Status | Notes |
|------|--------|-------|
| **Deploy API** | Documented | [DEPLOY.md](../DEPLOY.md) — Render, Railway, Docker; R2 env vars. |
| **Pre-launch checklist** | Documented | [LICENSES_AND_PRE_LAUNCH.md](LICENSES_AND_PRE_LAUNCH.md). |

**Verdict:** Deploy and legal/pre-launch are documented; do them when you’re ready to go live.

---

## Summary: what to do next

1. **Pilot**
   - Use current pipeline + **Streamlit dashboard** or **API `/view`** to show matches.
   - Collect videos and match data; optionally train `best.pt` (see [PILOT_AND_DATA_COLLECTION.md](PILOT_AND_DATA_COLLECTION.md)).

2. **Dashboard**
   - No big missing piece. Optional: polish `/view` and landing, improve “no match” state, mobile layout.

3. **Later (post-pilot)**
   - Ball tracking + padel analytics (if you want them).
   - Per-player heatmap.
   - Tracks DB, tests, calibration auto-fix, separate dashboard API — as needed.

**Bottom line:** The system is complete enough for a pilot. Dashboard works; what’s left is polish, optional features (ball, per-player heatmap, DB, tests), and deploy/launch when you’re ready.
