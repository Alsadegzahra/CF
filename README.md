# CourtFlow

**Integrated Match Video Capture & Intelligence System**

CourtFlow turns raw padel match video into structured post-match analytics. A fixed overhead camera records the match; the computer-vision pipeline detects and tracks all four players, maps their positions onto the physical court, and produces per-player heatmaps, physical load metrics, spatial zone coverage, and motion-based highlight clips. Players access results through a bilingual (English/Arabic) web dashboard — no app install required.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Language & Runtime | Python 3.9+ |
| API | FastAPI + Uvicorn |
| Vision | YOLOv8 + ByteTrack (Ultralytics) |
| Video processing | OpenCV, FFmpeg |
| Analytics | NumPy, pandas |
| Cloud storage | Cloudflare R2 (S3-compatible) |
| Auth & social | Supabase |
| Frontend | React + Vite (TypeScript) |
| Deployment | Render |
| Database | SQLite (file-based, no server required) |

---

## Folder Structure

```
CourtFlow/
├── src/                    # Python backend — pipeline, analytics, API
│   ├── app/                # FastAPI app, CLI entry points, auth
│   ├── pipeline/           # Orchestration: match_runner, pipeline stages
│   ├── vision/             # Detection (YOLO), tracking, mapping, ROI filter
│   ├── court/              # Court calibration, homography, keypoints
│   ├── analytics/          # 3-tier analytics engine, heatmap, PDF report
│   ├── highlights/         # Highlight selection and video clip export
│   ├── video/              # Frame extraction, video ingestion, overlays
│   ├── cloud/              # Cloudflare R2 upload, presigned URLs
│   ├── storage/            # SQLite match/court registry, tracks DB
│   ├── domain/             # Data models, enums, report contract
│   ├── config/             # Settings, constants
│   └── utils/              # Geometry, I/O, logging, time helpers
├── dashboard/              # React/Vite frontend
│   └── web/
│       └── src/            # Components, contexts, hooks, i18n (EN/AR)
├── models/                 # YOLO model weights (best.pt — gitignored)
├── data/                   # Courts config, match outputs (gitignored)
│   ├── courts/             # Per-court calibration artifacts
│   └── matches/            # Per-match reports, heatmaps, highlights
├── sample_videos/          # Short test clips for local pipeline runs
├── scripts/                # Standalone utility scripts
├── config/                 # Tracker configuration YAML files
│   └── trackers/
├── docs/                   # Architecture documentation
├── requirements.txt
├── Dockerfile
└── .env.example
```

---

## How to Run Locally

### 1. Install dependencies

```bash
pip install -r requirements.txt
cp .env.example .env        # fill in R2 credentials if you want cloud upload
```

FFmpeg must be on your system PATH (`brew install ffmpeg` on macOS).

### 2. Calibrate a court (first time only)

```bash
python3 -m src.app.cli calibrate-court --court_id court_001 --image /path/to/court_frame.jpg
```

### 3. Run the full pipeline on a video

```bash
# Option A — one command (ingest + pipeline)
python3 scripts/run_video_through_pipeline.py --input /path/to/match.mp4 --court_id court_001

# Option B — step by step
python3 -m src.app.cli ingest-match --court_id court_001 --input /path/to/match.mp4
python3 -m src.app.cli run-match
```

### 4. Start the API and open the dashboard

```bash
uvicorn src.app.api:app --reload
# Open: http://127.0.0.1:8000/app?match_id=<match_id>
```

### 5. (Optional) Upload results to cloud

```bash
python3 -m src.app.cli upload-match --match_id <match_id>
```

---

## CLI Commands Reference

| Command | Description |
|---|---|
| `calibrate-court` | One-time court setup — captures homography from a reference image |
| `ingest-match` | Register a video file as a new match |
| `run-match` | Run full detection → tracking → analytics → report pipeline |
| `upload-match` | Upload processed artifacts to Cloudflare R2 |

Run any command with `--help` for full options.

---

## Deploying to Render

1. Upload at least one processed match to R2 from your local machine
2. Create a Render web service pointing at this repo
   - **Build command:** `pip install -r requirements.txt`
   - **Start command:** `uvicorn src.app.api:app --host 0.0.0.0 --port $PORT`
3. Set environment variables: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET`, `R2_ACCOUNT_ID`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`

---

## Links

- **Live Demo:** https://courtflow-mqns.onrender.com
- **Repository:** https://github.com/Alsadegzahra/CF

---

## Team

CourtFlow — TIE 251, King Abdullah University of Science and Technology (KAUST)
