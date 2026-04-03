#!/bin/bash
# Record from RTSP for RECORD_SECONDS, then run CourtFlow pipeline.
# Run from repo root; or put this in scripts/ and run from repo root.
# Usage: COURTFLOW_DATA_DIR=/path RTSP_URL=rtsp://... RECORD_SECONDS=7200 ./scripts/edge_record_and_run.sh

set -e
COURT_ID="${COURT_ID:-court_001}"
RECORD_SECONDS="${RECORD_SECONDS:-7200}"
DATA_DIR="${COURTFLOW_DATA_DIR:-/mnt/courtflow/data}"
REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
RTSP_URL="${RTSP_URL:-rtsp://USER:PASS@CAMERA_IP:554/stream1}"

cd "$REPO_DIR"
source venv/bin/activate 2>/dev/null || true
export COURTFLOW_DATA_DIR="$DATA_DIR"

export MATCH_ID="match_$(date +%Y_%m_%d_%H%M%S)"
mkdir -p "$DATA_DIR/matches/$MATCH_ID/raw"
RAW_MP4="$DATA_DIR/matches/$MATCH_ID/raw/match.mp4"

echo "Recording for ${RECORD_SECONDS}s into $RAW_MP4"
ffmpeg -rtsp_transport tcp -i "$RTSP_URL" -t "$RECORD_SECONDS" -c copy -y "$RAW_MP4"

echo "Running ingest and pipeline for $MATCH_ID"
echo n | python3 -m src.app.cli ingest-match --court_id "$COURT_ID" --input "$RAW_MP4"
python3 -m src.app.cli run-match --match_id "$MATCH_ID"

echo "Done. Match $MATCH_ID report: $DATA_DIR/matches/$MATCH_ID/reports/"
