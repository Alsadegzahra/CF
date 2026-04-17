# CourtFlow

Turn raw match video into analytics and highlight videos. Pipeline: ingest → detect & track → map to court → report + heatmap + highlights. Data under `data/courts/` and `data/matches/` (gitignored).

---

## What’s in the repo

- **CLI:** `ingest-match`, `run-match`, `calibrate-court`, `upload-match` (R2)
- **API (FastAPI):** matches, report, artifacts, cloud URLs; serves the React dashboard at `/` (`/view?…` redirects to the same UI)
- **User dashboard:** React SPA in `dashboard/web` — `npm run build` then open `/?match_id=xxx` or `/view?match_id=xxx`
- **Cloud:** Cloudflare R2 for highlights + report; presigned links

---

## Quick start

```bash
pip install -r requirements.txt
cp .env.example .env   # optional: add R2_* for cloud

python3 -m src.app.cli ingest-match --court_id court_001 --input /path/to/video.mp4
python3 -m src.app.cli run-match
python3 -m uvicorn src.app.api:app --reload
# After `npm run build` in dashboard/web: http://127.0.0.1:8000/?match_id=<match_id>
```

**React dashboard with a real file:**

```bash
python3 scripts/run_video_through_pipeline.py --input ~/Desktop/sample2.mp4 --court_id court_002
# Terminal A: uvicorn …  Terminal B: npm run dev  → http://127.0.0.1:5173/?match_id=<id>
```

**Ship the UI with the API:** from repo root, `npm run build` (or `cd dashboard/web && npm run build`). FastAPI serves `dashboard/web/dist` at `/` and `/assets/*`.

**Slow `run-match`:** stage 02 (detection / YOLO) is usually the bottleneck.

**Custom detection weights:** put `best.pt` in `models/` (see `models/README.md`). Override with `--detection-model` or `COURTFLOW_DETECTION_MODEL`.

---

## Commands (summary)

| Step | Command |
|------|--------|
| Calibrate court | `python3 -m src.app.cli calibrate-court --court_id court_001` (see `--help` for image / video options) |
| Ingest match | `python3 -m src.app.cli ingest-match --court_id court_001 --input <video>` |
| Run pipeline | `python3 -m src.app.cli run-match` or `--match_id <id>` |
| API | `uvicorn src.app.api:app --reload` → http://127.0.0.1:8000/docs ; `/` = dashboard when `dist/` exists |
| Dashboard (dev) | `npm run dev` → http://127.0.0.1:5173/?match_id=… |
| Upload to R2 | `python3 -m src.app.cli upload-match --match_id <id>` |

---

## Deploy (e.g. Render)

1. **Upload at least one match to R2** from your machine (`.env` with R2 vars):  
   `python3 -m src.app.cli upload-match --match_id <your_match_id>`
2. **Web service:** repo root, Python 3, **Build:** `pip install -r requirements.txt`, **Start:** `uvicorn src.app.api:app --host 0.0.0.0 --port $PORT`
3. **Environment variables:** `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ACCOUNT_ID` (same as local `.env`). Do not set `PORT` on Render.
4. **Open:** `https://<your-service>.onrender.com/view?match_id=<id>` or `/?match_id=<id>` (same React app). API docs: `/docs`.

**Docker:** `docker build -t courtflow .` then run with `PORT` set; image uses `requirements.txt` and serves the API + committed `dashboard/web/dist`.

---

## Repo layout

- **Pipeline:** `src/pipeline/match_runner.py` → stages in `src/pipeline/stages.py`
- **Domain / report shapes:** `src/domain/models.py`, `src/domain/report_contract.py`
- **Tracker configs:** `config/trackers/*.yaml` (pass `--tracker` on `run-match`)
- **Training notebook:** `training/` (Colab YOLO for person detection)

Python 3.9+ · FastAPI, OpenCV, FFmpeg, Ultralytics (YOLO), SQLite; React (Vite) for the web UI.
