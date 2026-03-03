# Edge deployment: how to make it work

CourtFlow today is **file-in, pipeline-run**: you give it a video file, it runs ingest → track → map → report → overlay → highlights. On the edge you need: **get video from the camera onto the Pi**, then **run the same pipeline** on that file. This doc matches your BOM and describes how to do that.

---

## Full edge setup: wires and process (all processing on Pi)

This section walks through **physical wiring**, **power**, **network**, and **step-by-step process** so everything runs on the edge (Pi does recording + full pipeline).

### 1. Wiring and connections (physical)

```
                    POWER
                      │
    ┌─────────────────┼─────────────────┐
    │                 │                 │
    ▼                 ▼                 ▼
[Surge strip]   [PoE injector]   [27W USB-C PSU]
    │                 │                 │
    │            LAN in (from router)   │
    │                 │                 │
    │            PoE out ───────────────┼──────────► [Camera] 1080p PoE
    │                 │                 │              (Cat6, 20–30 m)
    │                 │                 └──────────► [Raspberry Pi 5]
    │                 │                                    │
    │                 └────── LAN ────────────────────────┤ Ethernet
    │                                                      │
    │                                                      ├── USB 3: External SSD (1TB)
    │                                                      ├── USB / M.2: Hailo accelerator (optional)
    │                                                      └── microSD: boot (or boot from SSD)
    │
    └────────────── [Router] (if court has no LAN: router creates local network;
                             camera + Pi get IPs from router)
```

**Per device:**

| Device | Cables / connections |
|--------|----------------------|
| **Surge protector** | Plug into wall. Everything else that needs AC plugs in here. |
| **Router** | Power from surge strip. WAN (optional): court’s internet. LAN ports: one to PoE injector “LAN in”, one to Pi Ethernet. |
| **PoE injector** | Power from surge strip. **LAN in**: Cat6 from router. **PoE out**: Cat6 (20–30 m) to camera. Camera gets power + data on this one cable. |
| **Camera** | Single Cat6 from PoE injector (PoE out). Mount so it sees the full court. No separate power cable. |
| **Pi 5** | **Power**: 27W USB-C from surge strip. **Ethernet**: Cat6 to router (same LAN as injector). **USB 3**: external SSD (1TB). **microSD**: boot. **Hailo** (optional): USB or M.2 depending on your Hailo model. **Active cooler**: on the Pi’s GPIO or USB, powered from Pi. |
| **External SSD** | USB 3 cable to Pi. Format ext4 (or exFAT if you need to move it). Mount at e.g. `/mnt/courtflow` for CourtFlow data. |

**Summary:** One cable from router to PoE injector, one long cable from injector to camera (power + data). Pi: power (USB-C), Ethernet to router, SSD on USB. All AC through surge strip.

---

### 2. Network (who talks to whom)

- **Router** gives DHCP to Pi and (if the injector is just pass-through) to the camera, or you set static IPs on the same subnet (e.g. 192.168.1.x).
- **Pi** and **camera** must be on the same LAN so the Pi can open the camera’s RTSP URL (e.g. `rtsp://192.168.1.100:554/stream1`).
- No internet required for recording or running the pipeline; internet is only needed if you upload to R2 or open external links.

---

### 3. Step-by-step: hardware setup

1. **Mount the camera** so the full court is in view (typical: high on one side). Run Cat6 from camera to where the Pi will sit (through cable clips, no sharp bends).
2. **Place surge strip** near power outlet. Plug in: router, PoE injector, 27W USB-C PSU.
3. **Router:** Connect **LAN** port 1 → **PoE injector “LAN in”**. Connect **LAN** port 2 → **Pi Ethernet**. Power on router.
4. **PoE injector:** Connect **PoE out** to the Cat6 that goes to the camera. Power on. Camera should get power and link (check camera’s status LED or web UI).
5. **Pi:** Insert microSD (with Raspberry Pi OS). Connect Ethernet to router. Connect 27W USB-C PSU. Connect external SSD (USB 3). Attach Hailo if used. Attach active cooler. Power on Pi.
6. **SSD:** After first boot, format and mount SSD (e.g. `/mnt/courtflow`). Use this for CourtFlow data (see software section).

---

### 4. Step-by-step: software setup (on the Pi)

1. **OS:** Raspberry Pi OS 64-bit (Bookworm). Boot from microSD (or clone to SSD and boot from SSD for speed).
2. **Updates and basics:**
   ```bash
   sudo apt update && sudo apt upgrade -y
   sudo apt install -y ffmpeg libgl1-mesa-glx libglib2.0-0 python3 python3-pip python3-venv git
   ```
3. **Mount SSD** (if not auto-mounted). Example:
   ```bash
   sudo mkdir -p /mnt/courtflow
   # Find SSD device (e.g. /dev/sda1) with: lsblk
   sudo mount /dev/sda1 /mnt/courtflow
   # Optional: add to /etc/fstab for boot mount
   ```
4. **CourtFlow on SSD:**
   ```bash
   cd /mnt/courtflow
   git clone <your-courtflow-repo-url> courtflow
   cd courtflow
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
5. **Data on SSD:** Use the same disk for repo and data so recordings and outputs don’t fill the microSD.
   ```bash
   export COURTFLOW_DATA_DIR=/mnt/courtflow/data
   mkdir -p $COURTFLOW_DATA_DIR
   ```
   Add `COURTFLOW_DATA_DIR=/mnt/courtflow/data` to your shell profile or a small `.env` in the repo root.
6. **Camera RTSP URL:** From a PC on the same LAN (or from the Pi), open the camera’s web UI (e.g. http://192.168.1.100), create an admin user if needed, and note the RTSP URL (e.g. `rtsp://admin:password@192.168.1.100:554/stream1`). Test from the Pi:
   ```bash
   ffmpeg -rtsp_transport tcp -i "rtsp://USER:PASS@CAMERA_IP:554/stream1" -t 5 -c copy -y /tmp/test.mp4
   ```
   If that creates a small file, the Pi can record the camera.
7. **Calibration (once per court):** On your laptop, run the pipeline on one clip from this camera, run `calibrate-court` for that court, then copy `data/courts/<court_id>/calibration/` to the Pi’s `$COURTFLOW_DATA_DIR/courts/<court_id>/calibration/`. Or do calibration on the Pi if you have a display.

---

### 5. End-to-end process (one match, all on Pi)

**Before the match (one-time per court):** Calibration is in place under `data/courts/court_001/calibration/` (or your court_id). CourtFlow venv is activated and `COURTFLOW_DATA_DIR` is set.

**When the match starts:**

1. **SSH or keyboard/monitor to the Pi.** Go to CourtFlow repo and activate venv:
   ```bash
   cd /mnt/courtflow/courtflow
   source venv/bin/activate
   export MATCH_ID="match_$(date +%Y_%m_%d_%H%M%S)"
   mkdir -p $COURTFLOW_DATA_DIR/matches/$MATCH_ID/raw
   ```
2. **Start recording** (replace with your camera’s RTSP URL and credentials):
   ```bash
   ffmpeg -rtsp_transport tcp -i "rtsp://USER:PASS@CAMERA_IP:554/stream1" \
     -c copy -y $COURTFLOW_DATA_DIR/matches/$MATCH_ID/raw/match.mp4
   ```
   Leave this running. When the match ends, press **Ctrl+C** to stop. You now have `.../matches/$MATCH_ID/raw/match.mp4`.

**When the match has ended:**

3. **Register the match and run the pipeline** (all on the Pi):
   ```bash
   python3 -m src.app.cli ingest-match --court_id court_001 \
     --input $COURTFLOW_DATA_DIR/matches/$MATCH_ID/raw/match.mp4
   ```
   When prompted “Define court points for this court now? [y/N]:” type **n** and Enter if you already calibrated.
4. **Run full pipeline** (detection, tracking, map, report, heatmap, overlay, highlights):
   ```bash
   python3 -m src.app.cli run-match --match_id $MATCH_ID
   ```
   This reads the video from SSD, runs YOLO + ByteTrack, writes report, heatmap, overlay video, and highlights to `$COURTFLOW_DATA_DIR/matches/$MATCH_ID/`. On Pi CPU this can take a while (tens of minutes per hour of video); Hailo would speed it up once integrated.

**View results:**

5. **On the Pi (optional):** Start the API so you can open the dashboard from another device on the same LAN:
   ```bash
   uvicorn src.app.api:app --host 0.0.0.0 --port 8000
   ```
   From a phone or laptop on the same Wi‑Fi: `http://<PI_IP>:8000/view?match_id=$MATCH_ID`.
6. **Or copy results from SSD:** Report, heatmap, and highlights are under `$COURTFLOW_DATA_DIR/matches/$MATCH_ID/reports/` and `.../highlights/`. You can copy that folder to a laptop or upload to R2 if you have internet.

---

### 6. Optional: script to tie it together

You can add a small script on the Pi that:

1. Asks for court_id and generates match_id.
2. Creates `matches/$MATCH_ID/raw/` and starts FFmpeg recording (RTSP → match.mp4).
3. Waits for you to press Enter (or a key) when the match ends, then stops FFmpeg.
4. Runs `ingest-match` and `run-match` with that match_id.
5. Prints where the report and highlights are, and optionally starts the API.

That way you don’t have to remember the exact commands; the “wires and process” stay the same as above.

---

## Your bill of materials (BOM)

| Item | Role |
|------|------|
| **1080p PoE IP Camera** | Video source (RTSP/ONVIF stream). |
| **PoE Injector / PoE Switch** | Power + data to camera over Ethernet. |
| **Cat6 (20–30 m)** | Camera to router/switch. |
| **Raspberry Pi 5 (8GB)** | Runs recording + CourtFlow pipeline (or recording only; see below). |
| **Hailo AI Accelerator** | Optional: run YOLO inference on Hailo instead of Pi CPU (faster). |
| **Active cooling + 27W PSU** | Keep Pi stable under load. |
| **External SSD (1TB)** | OS (optional), **match videos**, and pipeline outputs (tracks, report, heatmap, highlights). |
| **microSD** | Boot (if not booting from SSD). |
| **Edge enclosure, surge protector, router, cable clips** | Mounting, power, network. |

---

## How it works: record then process

CourtFlow does **not** process a live stream directly. It expects a **video file**. So the edge flow is:

1. **Record** the match from the camera (RTSP) to a file on the Pi (or on a NAS the Pi can read).
2. **Run the pipeline** on that file: `ingest-match` (or point at the file) → `run-match`.
3. **Store results** on the SSD (and optionally upload to R2 for the web dashboard).

So: **edge = “camera → recorded file → same CourtFlow pipeline as on your laptop.”**

---

## Two deployment options

### Option A: Pi does recording + pipeline (all on Pi)

- **Camera** → RTSP stream → **Pi** records to SSD (e.g. `data/matches/<match_id>/raw/match.mp4`).
- When the match ends, Pi runs `ingest-match` (if needed) and `run-match`.
- Pros: single device, no cloud needed for processing.  
- Cons: Pi 5 must run YOLO (CPU or Hailo). CPU-only at 1080p may be slow; Hailo speeds it up (see below).

### Option B: Pi records only; pipeline runs elsewhere

- **Camera** → **Pi** records stream to SSD (or to a NAS).
- After the match, **copy the video** to a server/PC that runs CourtFlow (ingest + run-match).
- Pros: pipeline runs on a more powerful machine; no need to optimize Pi for YOLO.  
- Cons: you need a second machine or cloud job to run the pipeline.

**For “easiest start” at one court:** Option B is simpler (Pi = recorder; run pipeline on a laptop or small server). Option A is better when you want **everything on the edge** (no video leave the site).

---

## Getting video onto the Pi (record from camera)

Your camera is 1080p PoE and almost certainly exposes an **RTSP** or **ONVIF** stream. Example RTSP URL (vendor-dependent):

- `rtsp://admin:password@192.168.1.100:554/stream1`  
- Or use the camera’s web UI / manual to find the RTSP URL.

**Record a match with FFmpeg (on the Pi):**

```bash
# Create match dir (use a match_id, e.g. from date/time)
export MATCH_ID="match_$(date +%Y_%m_%d_%H%M%S)"
mkdir -p /path/to/data/matches/$MATCH_ID/raw

# Record 1 hour (or until you stop) from RTSP → match.mp4
ffmpeg -rtsp_transport tcp -i "rtsp://USER:PASS@CAMERA_IP:554/stream1" \
  -t 3600 -c copy -y /path/to/data/matches/$MATCH_ID/raw/match.mp4
```

- Run this when the match starts; stop with Ctrl+C when it ends (or use a timeout `-t`).
- Then point CourtFlow at `data/matches/$MATCH_ID` (see below).

**What’s not in the repo yet:** No automatic “start/stop recording” or “create match from RTSP” in the CLI. You can add a small script that: (1) creates `match_id`, (2) runs `ffmpeg -i rtsp://... -c copy ... match.mp4`, (3) on stop, runs `ingest-match` (with `--input` = that file) and `run-match`. The pipeline itself stays the same.

---

## Running the pipeline on the Pi (Option A)

1. **OS:** Raspberry Pi OS 64-bit (Bullseye/Bookworm).
2. **Python:** 3.9+ (e.g. `sudo apt install python3 python3-pip python3-venv`).
3. **System deps:** FFmpeg, OpenCV (headless) deps:
   ```bash
   sudo apt update
   sudo apt install -y ffmpeg libgl1-mesa-glx libglib2.0-0
   ```
4. **CourtFlow:** Clone repo onto SSD (or microSD), create venv, install:
   ```bash
   python3 -m venv venv
   source venv/bin/activate
   pip install -r requirements.txt
   ```
5. **Data dir:** Put `data/` (courts, matches) on the **SSD** (e.g. mount SSD at `/mnt/courtflow`, set `COURTFLOW_DATA_DIR=/mnt/courtflow/data`).
6. **Calibration:** Do court calibration once (on a frame from this camera) and put the result in `data/courts/<court_id>/calibration/`.
7. **Run pipeline** (after recording a match):
   ```bash
   # If you recorded to data/matches/<match_id>/raw/match.mp4, create match in DB and run pipeline:
   python3 -m src.app.cli ingest-match --court_id court_001 --input /path/to/data/matches/$MATCH_ID/raw/match.mp4
   # (when prompted "Define court points?" answer n if already calibrated)
   python3 -m src.app.cli run-match --match_id $MATCH_ID
   ```

If you use a script that creates `match_id` and writes `raw/match.mp4`, you can call the same two commands from that script.

---

## Speed: Pi CPU vs Hailo

- **Pi 5 CPU only:** YOLO (Ultralytics) on 1080p at 1 FPS (or sub-sampled frames) may be acceptable but slow (e.g. 30–60+ min per hour of video). Reducing resolution or `--sample_every_n_frames` helps.
- **Hailo:** Runs YOLO much faster. Integration is **outside** current CourtFlow: you’d export the detection model (e.g. YOLO → ONNX), compile/run it with **Hailo’s SDK** on the Pi, and either (a) replace the Ultralytics call in CourtFlow with a Hailo inference step, or (b) run a small “Hailo detector” that writes detections to a format CourtFlow can consume. So: **CourtFlow works on the edge today with Pi CPU**; Hailo is an optimization you add (model export + Hailo runtime + glue code).

---

## Checklist: make it work on the edge

| Step | Action |
|------|--------|
| 1 | Wire camera (PoE), set IP, get RTSP URL from camera UI. |
| 2 | On Pi: install OS, Python, FFmpeg, CourtFlow deps; mount SSD as data dir. |
| 3 | Calibrate court once (frame from this camera) → `data/courts/court_001/calibration/`. |
| 4 | Record one match: `ffmpeg -i rtsp://... -c copy ... match.mp4` into `data/matches/<match_id>/raw/`. |
| 5 | Run `ingest-match` (input = that file) then `run-match --match_id <match_id>`. |
| 6 | Check outputs on SSD: report, heatmap, overlay, highlights. Optionally upload to R2 and open `/view?match_id=...`. |

Optional later: script to start/stop recording and auto-run pipeline; Hailo for faster inference; run API/dashboard on Pi so you can open the view on the court’s LAN.

---

## Summary

- **Current CourtFlow:** File-in, pipeline-run (ingest → track → map → report → overlay → highlights). No live stream; no built-in RTSP recording.
- **Edge with your BOM:** Camera (1080p PoE) → record RTSP to file on Pi (or NAS) → run the **same** pipeline on that file. Pi can do both recording and pipeline (Option A) or only recording (Option B).
- **Easiest start:** Pi records; run ingest + run-match on the Pi (Option A) or copy the file and run pipeline on a laptop/server (Option B). Add Hailo later if you need faster inference on the Pi.
