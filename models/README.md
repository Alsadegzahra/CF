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

## Ball weights (optional, separate file)

Player and ball use **different** checkpoints. If you **do not** have ball weights yet, you do not need to do anything: `run-match` skips ball inference, and any old `data/matches/<id>/tracks/ball.json` is **removed** so the analytics HUD does not show a false “ball” flag.

When you have a ball-only Ultralytics `.pt` (single-class ball is usually **class 0**):

1. Save it as **`models/ball_best.pt`** (gitignored like `best.pt`), or set **`COURTFLOW_BALL_MODEL`** / **`--ball-model /path/to/weights.pt`**.
2. Run with **`--ball-class-id 0`** if the model has one class at index 0.

Obtain weights by training on labeled ball crops from your footage, or from another project you trust and are allowed to use — CourtFlow does not ship ball weights.
