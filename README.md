# CourtFlow

Turn raw match video into analytics and highlight videos. Pipeline: ingest → detect & track → map to court → report + heatmap + highlights. Data in `data/courts/` and `data/matches/`.

---

## What’s in the repo

- **CLI:** `ingest-match`, `run-match`, `calibrate-court`, `upload-match` (R2)
- **API (FastAPI):** matches, report, artifacts, cloud URLs; serves user dashboard at `/view`
- **User dashboard:** `/view?match_id=xxx` — report, heatmap, highlights (shareable link)
- **Ops dashboard (Streamlit):** full view of matches, tracks, report, uploads
- **Cloud:** Cloudflare R2 for highlights + report; presigned links

---

## Quick start

```bash
pip install -r requirements.txt
cp .env.example .env   # optional: add R2_* for cloud

# Ingest video → run pipeline → view (classic HTML)
python3 -m src.app.cli ingest-match --court_id court_001 --input /path/to/video.mp4
python3 -m src.app.cli run-match
python3 -m uvicorn src.app.api:app --reload
# Open http://127.0.0.1:8000/view?match_id=<match_id>
```

**React dashboard (`dashboard/web`) with a real file (e.g. `sample2.mp4`):**

```bash
# One-shot ingest + pipeline (non-interactive); prints match_id and URLs
python3 scripts/run_video_through_pipeline.py --input ~/Desktop/sample2.mp4 --court_id court_002

# Terminal A — API (serves JSON + optional built UI at /app)
python3 -m uvicorn src.app.api:app --reload

# Terminal B — Vite dev UI (proxies /matches → API)
npm run dev
# Open http://127.0.0.1:5173/?match_id=<match_id_from_script>
```

**Ship the React UI from the same process as the API:** `npm run build`, then open `http://127.0.0.1:8000/app/?match_id=<id>` (FastAPI mounts `dashboard/web/dist` at `/app` when `dist/` exists).

**If run-match is slow:** Stage 02 (detection) is the heavy part. See [docs/RUN_MATCH_TIME_AND_RESULTS.md](docs/RUN_MATCH_TIME_AND_RESULTS.md).

**Custom detection model:** Put `best.pt` in `models/` and use `--detection-model models/best.pt`. See [models/README.md](models/README.md).

---

## How to run (summary)

| Step | Command |
|------|--------|
| Calibrate court (stub) | `python3 -m src.app.cli calibrate-court --court_id court_001` |
| Ingest match | `python3 -m src.app.cli ingest-match --court_id court_001 --input <video>` |
| Run pipeline | `python3 -m src.app.cli run-match` or `--match_id <id>` |
| API | `uvicorn src.app.api:app --reload` → http://127.0.0.1:8000/docs ; **http://127.0.0.1:8000/** redirects to **/app/** when `dashboard/web/dist` exists (React UI + **Try demo**) |
| Ops dashboard | `streamlit run dashboard/app.py` |
| User dashboard (React, **recommended**) | `npm run build` → http://127.0.0.1:8000/app/?match_id=\<id\> (same UI as Vite dev) |
| User dashboard (React dev) | `npm run dev` → http://127.0.0.1:5173/?match_id=\<id\> (API on :8000) |
| Legacy `/view` | Redirects to `/app/…` when `dashboard/web/dist` exists; else old `view.html` |
| Upload to R2 | `python3 -m src.app.cli upload-match --match_id <id>` |

---

## Deploy

Upload a match to R2, then deploy the API (Render, Railway, or Docker). Set env: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ACCOUNT_ID`.  
**Full steps:** [DEPLOY.md](DEPLOY.md).

---

## Docs and structure

- **Docs index:** [docs/README.md](docs/README.md) — testing, calibration, detection training, run time, contracts
- **Pipeline:** `src/pipeline/match_runner.py` → stages 01–06 in `src/pipeline/stages.py`
- **Contracts:** `src/domain/models.py`, `src/domain/report_contract.py`
- **Cloud:** [DEPLOY.md](DEPLOY.md) and R2 section in docs

Python 3.9+ · FastAPI, OpenCV, FFmpeg, Ultralytics (YOLO), SQLite, Streamlit.
