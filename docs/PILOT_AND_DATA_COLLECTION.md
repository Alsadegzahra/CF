# Pilot and data collection — don’t get stuck on tracking

Use this when you want to **run a pilot, collect your own data, and train the model later** without blocking on perfect tracking.

---

## 0. Easiest start: one environment, one court

**For the pilot, pick the path of least resistance.**

| Do this | Why |
|--------|-----|
| **One court** | One calibration, one `court_id`, repeatable. |
| **One environment** | Either **all indoor** or **all outdoor** for the pilot. Same lighting/background → one model (`best.pt`) fits that setup. |
| **One camera position** | Same angle and height every time → calibration and detection stay consistent. |

**Easiest start in practice:** Choose **one** court you can access often (indoor or outdoor). Run all pilot matches there with the same camera. Collect data. Train one `best.pt` on that data. You’re not building “indoor vs outdoor” yet — you’re proving the pipeline and collecting your first real dataset.

**Later (after pilot):** When you add more courts, you can do **indoor + outdoor**. Then either: (a) one model trained on mixed indoor/outdoor data, or (b) separate models or court-type flags (e.g. `court_001` = indoor, `court_002` = outdoor) and train per environment. The product can serve both; the pilot doesn’t have to.

---

## 1. “Good enough” for the pilot

You **don’t need** perfect P1–P4 tracking to run the pilot.

**Enough for the pilot:**

- Detection is good (players and court visible).
- Pipeline runs end-to-end: ingest → track → map → report → overlay.
- You get heatmaps, reports, overlay videos; IDs may swap or show “?” sometimes.

**You can move on when:**

- You can process real matches from your camera/court.
- Outputs (overlay, report, heatmap) are usable for demos or internal review.
- You’re collecting **videos + match metadata** for future training.

**Don’t wait for:**

- Zero “?” or zero ID swaps.
- Broadcast-grade identity every frame.

---

## 2. What to collect during the pilot

| What | Why |
|------|-----|
| **Raw match videos** | Same angle/court as production → best data to train detection (and later ReID if you want). |
| **Match metadata** | Court ID, date, duration — so you can match clips to training later. |
| **Ingested matches in CourtFlow** | Run `ingest-match` + `run-match`; keep the match folders. You get tracks, overlays, reports even if tracking isn’t perfect. |
| **List of “good” vs “bad” matches** | Note which videos have acceptable detection/tracking; use the good ones first for training. |

**Optional later:** If you ever want to improve **tracking** (e.g. ReID) with your data, you can add identity labels (P1–P4 per frame) on a subset of clips. For the first phase, **focus on detection**: frames + person boxes are enough to train `best.pt`.

---

## 3. Workflow: pilot → data → training

1. **Pilot**
   - Use your camera (e.g. 30 fps).
   - Ingest and run matches with default settings (ByteTrack + smoothing).
   - Don’t tune tracking for hours; note issues and move on.

2. **Collect**
   - Keep all raw videos and CourtFlow match outputs (or at least the match IDs and paths).
   - Optionally export frames from “good” matches for annotation.

3. **Train detection**
   - Use the data you collected to build a YOLO **person** dataset (same angle, same court).
   - Train → get `best.pt` → put in `models/best.pt`.
   - See ** [DETECTION_TRAINING.md](DETECTION_TRAINING.md)** for dataset format, Colab, and CourtFlow usage.

4. **Re-run pipeline with new model**
   - Same pipeline; better detection often improves tracking indirectly (more stable boxes → fewer ID switches).

---

## 4. Commands to run the pilot

```bash
# Ingest (one time per video)
python3 -m src.app.cli ingest-match --court_id court_002 --input /path/to/match_video.mp4

# Run full pipeline (default ByteTrack + smoothing)
python3 -m src.app.cli run-match --match_id match_YYYY_MM_DD_HHMMSS
```

If tracking is clearly wrong (e.g. same kit), try:

```bash
python3 -m src.app.cli run-match --match_id match_YYYY_MM_DD_HHMMSS --same-kit
```

Otherwise, **don’t get stuck** — collect the run, note the match_id, and use the data later for training.
