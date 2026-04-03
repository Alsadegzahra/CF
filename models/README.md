# Custom detection weights (optional)

Default is pretrained YOLO (YOLO26n / YOLOv8n). To use a **trained model** (e.g. from **CF_Training** or a teammate):

1. **Copy `best.pt`** from the training project into this folder: `models/best.pt` (file is gitignored).
2. **Run:** With `models/best.pt` in place, the pipeline uses it automatically for player detection. No flag needed:
   ```bash
   python3 -m src.app.cli run-match
   ```
   To override (e.g. use pretrained): `--detection-model yolo26n.pt`. Or set in `.env`: `COURTFLOW_DETECTION_MODEL=./models/best.pt` to force a path.
3. **Back to pretrained:** Remove or rename `models/best.pt`, or run with `--detection-model yolo26n.pt`.

The model is **detection only** (person bounding boxes per frame). CourtFlow runs its **tracker** on top to get stable player IDs. Support for 2, 3, or 4 players is handled by pipeline logic (canonical 4 players; filter by ROI / court center).

**Requirements:** Ultralytics `.pt`, **person/player as class 0**.  
Training: [docs/DETECTION_TRAINING.md](../docs/DETECTION_TRAINING.md).

**Same results as testing best.pt alone?** Use default ingest (copy as-is) and run with defaults (no ROI, conf 0.25). See [docs/DETECTION_AND_TRACKING_OPTIONS.md](../docs/DETECTION_AND_TRACKING_OPTIONS.md).
