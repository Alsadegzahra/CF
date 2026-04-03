# CourtFlow — what is working today (for presentations)

Single source of truth for **implemented and usable** features. Use this to populate slides (“System Evolution,” “Core Modules,” “MVP,” etc.).

---

## 1. Operator surface (CLI)

| Command | What it does (working) |
|---------|-------------------------|
| **`calibrate-court`** | Save homography for a court: click **4 or 12** points on image/video, copy **homography file**, or **identity** H from resolution only. Writes `homography.json`, optional `calib_frame`, **ROI polygon**. |
| **`ingest-match`** | Create match in DB, **copy or re-encode** video to `raw/match.mp4`, set state **FINALIZED**, optional prompt to calibrate. |
| **`run-match`** | Full **6-stage pipeline** for a match (by `--match_id` or latest FINALIZED). Flags: `--conf`, `--iou`, `--sample_every`, `--tracker`, `--same-kit`, `--detection-only`, `--pose`, `--use_roi`, `--skip-first-seconds`, `--detection-model`. |
| **`daily-check`** | Loop over FINALIZED matches (batch-style entry point). |
| **`upload-match`** | Upload highlights + report + heatmap to **Cloudflare R2** when configured. |

---

## 2. End-to-end pipeline (6 stages)

| Stage | Working output |
|-------|----------------|
| **01 Load calibration** | Copy court calibration into match dir; homography + ROI available for mapping. |
| **02 Detect & track** | YOLO **person** detection; **`models/best.pt`** if present else pretrained. **ByteTrack** default (`config/trackers/bytetrack_padel.yaml`); **BoT-SORT** optional; **detection-only** mode (no tracker). **Canonical P1–P4**, re-anchor, **swap correction**, **EMA smoothing**. Optional **court-side prior** (homography). Optional **`--pose`**: ground point + keypoints + skeleton on overlay. |
| **03 Map to court** | `x_pixel`/`y_pixel` → **`x_court`/`y_court`** via homography; writes updated `tracks.json`. |
| **04 Report** | **`report.json`**: summary, per-player metrics, heatmaps paths, zones, intensity highlights, **`tracking_mode`** (`tracking` vs `detection_only`). |
| **05 Renders** | Sample PNGs, **`track_overlay_preview.mp4`** (boxes + optional pose), **player thumbnails** (4 sections to avoid repeats). |
| **06 Highlights** | **`highlights/highlights.mp4`** (and clip selection from intensity windows). |

---

## 3. Detection & tracking (working options)

- **Default tracker:** ByteTrack — **no ReID** (simpler ops).
- **Alternatives:** BoT-SORT + ReID (`botsort_padel.yaml`); **same-kit** configs; **long-buffer** ByteTrack config.
- **BoT-SORT ReID patch:** Uses ReID when IoU is *very* bad (occlusion); tolerant to Ultralytics class name changes.
- **Detection-only:** Full pipeline still runs; P1–P4 **by position per frame**; report marks `tracking_mode`.

---

## 4. Calibration (working)

- Manual **click calibration** (4 or 12 points), **ROI** from first 4 points.
- Load/copy **homography JSON**; **identity** homography for testing.
- Per-court artifacts under **`data/courts/<court_id>/calibration/`**.

---

## 5. Analytics in `report.json` (working)

From **`src/analytics/`** (see **`docs/FEATURES_CHECKLIST.md`** for the full PDF mapping):

- **Match:** duration, total distance, num players, **insight** one-liner.
- **Per player (P1–P4):** distance, duration, avg/max speed, **sprint count**, **acceleration peaks**, **deceleration count**, **lateral_movement_pct**, rank, share of distance, **zone_coverage_pct** (6 zones), **net_pct** / **baseline_pct**.
- **Team:** **team spacing** (P1–P2, P3–P4) in meters.
- **Heatmaps:** combined + **per-player** PNG paths under `reports/`.
- **Highlights:** motion-based windows in report; drives export.
- **Padel block:** rally / shot / wall — **stubbed** (no ball yet).

**Not implemented** (documented as future): coverage gap, positional drift, baseline→net transition count, positional efficiency score, load across match thirds, fatigue trend, intensity drop-off (see FEATURES_CHECKLIST §6–9, §18–20).

---

## 6. Video & UX outputs (working)

| Artifact | Location |
|----------|----------|
| Tracks | `tracks/tracks.json`, optional `tracks_raw.json` |
| Report | `reports/report.json` |
| Heatmaps | `reports/heatmap.png`, `heatmap_player_1..4.png` |
| Overlay video | `renders/track_overlay_preview.mp4` |
| Sample frames | `renders/track_overlay_frame_*.png` |
| Thumbnails | `renders/player_1..4_thumb.jpg` |
| Highlights | `highlights/highlights.mp4` |

---

## 7. API & dashboards (working)

- **FastAPI** (`src/app/api.py`): **`/health`**, **`/`** landing, **`/view`** user dashboard, **`/matches`**, match detail, **report JSON**, **artifact files**, presigned **R2 URLs** when configured.
- **User dashboard:** `dashboard/view.html` — report summary, heatmap, highlights, player cards (match id in query string).
- **Ops dashboard:** Streamlit `dashboard/app.py` — browse matches, analytics, video.

---

## 8. Cloud & deploy (working)

- **R2 upload** after successful `run-match` (when env vars set).
- **Edge:** `docs/EDGE_DEPLOYMENT.md` + **`scripts/edge_record_and_run.sh`** — record RTSP → ingest → run-match (cron-friendly).

---

## 9. Documentation set (repo)

Indexed in **`docs/README.md`**: contracts, calibration, detection/tracking, training, heatmaps, intelligence, licenses, pilot, edge, testing, TODOs, **FEATURES_WITHOUT_REID**, **TRACKING_*** notes, etc.

---

## 10. Suggested slide bullets (“what we have”)

- **One command** from ingested match video to **report + heatmaps + overlay + highlights**.
- **ByteTrack by default** — full product **without ReID**; BoT-SORT optional.
- **Court calibration** → **2D court coordinates** for all metrics.
- **18+ motion/spatial metrics** implemented; **7** advanced items still on roadmap.
- **Web viewer** + **Streamlit ops** + **optional cloud upload**.
- **Edge path** documented for club deploy (Pi + camera + script).

---

*Last aligned with codebase: use this file + `FEATURES_CHECKLIST.md` + `WHATS_LEFT_IN_THE_SYSTEM.md` for pitch vs roadmap.*
