# Using a custom-trained YOLO model for player detection

CourtFlow uses **person detection** (COCO class 0) for tracking. By default it loads a **pretrained** model (`yolo26n.pt` or `yolov8n.pt`). For better accuracy on padel/court footage—especially when all your matches are from the **same camera angle**—you can **train your own YOLO** and use the resulting `best.pt` in CourtFlow.

**Contract:** One class only — **person** — must be **class index 0** in the dataset and in the trained model, so CourtFlow can use `classes=[0]`. Output: a single **best.pt** file.

---

## Where to do the training

**Recommendation: train in a different repo (or Colab/notebook), then bring the weights file into CourtFlow.**

| Approach | Why |
|----------|-----|
| **Separate repo** | Keeps datasets, labels, and training scripts out of the app repo. Different env (e.g. GPU, extra deps). You only deliver a single `best.pt` file. |
| **Colab / notebook** | Good for one-off or small experiments; same idea: train there, download `best.pt`, add it to CourtFlow. |
| **Inside CourtFlow** | Possible (e.g. a `training/` folder and scripts), but mixes app and ML workflows and can bloat the repo with data and run artifacts. |

**Workflow:** Train elsewhere → get `best.pt` (e.g. from `runs/detect/train/weights/best.pt`) → copy into CourtFlow (e.g. `models/best.pt`) or set `COURTFLOW_DETECTION_MODEL`. CourtFlow only needs the `.pt` file at inference time.

**When someone else trains the model (e.g. a teammate):** Put the `best.pt` file they send into **`models/`** and follow **[models/README.md](../models/README.md)**. No training setup required in this repo.

---

## Training in Google Colab (separate from CourtFlow)

You can do **all training in Colab**—no CourtFlow repo needed. Only the final **best.pt** file is used in CourtFlow later.

**Setup in Colab**

1. **Open a new notebook:** [colab.research.google.com](https://colab.research.google.com).
2. **Enable GPU:** Menu **Runtime → Change runtime type → Hardware accelerator: GPU** (T4 is enough). Save.
3. **Prepare your dataset locally** (on your machine) in the structure from [§2. Dataset structure and format](#2-dataset-structure-and-format):
   - One folder (e.g. `padel_person/`) with `data.yaml`, `images/train`, `images/val`, `labels/train`, `labels/val`.
   - Zip it: `padel_person.zip`.

**In Colab, either:**

- **Option A – Upload zip:** In a cell, use a file upload widget to upload `padel_person.zip`, unzip into the runtime, then run training. When done, download `best.pt` (e.g. from the left Files panel or with a short script).
- **Option B – Google Drive:** Upload the dataset folder to Drive (or put the zip there). In Colab, mount Drive, point `data.yaml`’s `path` to the dataset folder on Drive, then run training. Save `best.pt` back to Drive or download it.

**Where to do all training work: CF_Training (e.g. on Desktop)**  
Keep all training work in a **separate folder** (e.g. **`CF_Training`** on your Desktop). That folder should contain:

- **padel_yolo_train_colab.ipynb** — upload to Colab to train and download **best.pt**
- **README.md** — workflow and dataset summary
- **dataset_guide.md** — where to get data, extract frames, annotate, build the zip
- **data.yaml.example** — template for your dataset’s `data.yaml`

Open [Google Colab](https://colab.research.google.com) → **File → Upload notebook** → choose **padel_yolo_train_colab.ipynb** from your CF_Training folder. Enable GPU, upload your dataset zip (or use Drive), run the cells, then download **best.pt**. No CourtFlow repo is required for training.

**After training in Colab**  
Download **best.pt** from Colab (Files → `runs/detect/train/weights/best.pt` → right‑click Download, or use the notebook’s download cell). Copy it into CourtFlow at `models/best.pt` and use `--detection-model models/best.pt` (or set `COURTFLOW_DETECTION_MODEL`).

---

## End-to-end: from data to best.pt

High-level path:

1. **Get or create data** → extract frames (if from video) → annotate **person** as class **0** → export YOLO format.
2. **Organize dataset** → folder layout + `data.yaml`.
3. **Train** → Ultralytics `yolo detect train` → use `runs/detect/train/weights/best.pt`.
4. **Use in CourtFlow** → `--detection-model path/to/best.pt` or `COURTFLOW_DETECTION_MODEL`.

Rough time (depends on dataset size and GPU):

- **Data:** 1–3+ hours (extraction minutes; annotation dominates: ~2–5 min per image for full manual, less with semi-auto).
- **Training:** ~30 min–2 h (e.g. 500 images, 50 epochs, YOLOv8n on a mid-range GPU).
- **Total:** From “raw videos” to “best.pt ready” can be **half a day to a day** for a small same-angle dataset (300–800 images); more if you label thousands of images.

---

## 1. Where to find or create training data

### Option A – Your own padel videos (best for same angle)

Since all your matches are from the same court/camera, training on frames from that same angle gives the most accurate model.

**Extract frames**

- **ffmpeg** — sample every N frames (e.g. every 30 or 60 to get variety without too many images):

  ```bash
  ffmpeg -i match.mp4 -vf "select=not(mod(n\,30))" -vsync vfr frames/frame_%04d.jpg
  ```

  Or every 2 seconds (if 30 fps): `-vf "select=not(mod(n\,60))"`.

- **Python/OpenCV** — same idea: read video, save every Nth frame. Gives full control over naming and folder layout.

**How many images to aim for**

- **Minimum useful:** ~300–500 labeled images (train + val).
- **Better:** 500–1500. More is better up to a point; for a single fixed angle, 800–1200 can be enough.
- **Split:** Typically 80% train / 20% val (or 85/15). Prefer splitting **by video** (e.g. one match → train, another → val) so val reflects unseen matches, not just later frames of the same clip.

**Annotate (one class: person = 0)**

Draw bounding boxes around every **person** (player) in each image. Use a tool that exports **YOLO format**:

| Tool | Notes |
|------|--------|
| [Roboflow](https://roboflow.com) | Free tier, upload images, draw boxes, export “YOLOv8” format. Single class “person” → class 0. |
| [CVAT](https://www.cvat.ai) | Open source, self-host or use cvat.ai. Create project, one label “person”, export format “YOLO 1.1”. |
| [labelImg](https://github.com/HumanSignal/labelImg) | Desktop (pip/conda). Set “PascalVOC” to “YOLO” in the menu; create one class “person” (saved as 0 in the `.txt` files). |

Ensure the exported label files have **one class only**, and that class is **0** (e.g. each line: `0 x_center y_center width height` normalized 0–1). If the tool uses “person” as name, map it to index 0 when exporting.

### Option B – Public padel / sports player datasets

- **Roboflow Universe:** Search “padel”, “sports person”, “tennis player”, “person detection”. Many datasets are in COCO or other formats; use Roboflow’s “Export” → “YOLOv8” and, if multiple classes, keep only “person” and ensure it is class 0.
- **Kaggle:** e.g. “padel dataset”, “sports player detection”, “person detection”. Download and convert to YOLO (one class, index 0) with a small script or Roboflow.
- **Papers / DS_Padel:** Some papers release “amateur padel” or similar datasets. If they provide bounding boxes, convert to YOLO format and a single “person” class (0).

**If the public dataset has multiple classes:** Filter to person-only and remap to class 0. For example, in COCO, person is already 0; in other schemes, export only person and assign class 0 in the `.txt` files. If the camera angle is very different from yours, detection may be worse; same-angle data is usually best.

### Option C – Semi-automatic labeling (recommended to speed up)

1. Extract frames from your match videos (same angle as production).
2. Run a **pretrained** YOLO (e.g. `yolov8m.pt` or `yolo26m.pt`) in predict mode on those frames and **save predictions** (person boxes) as initial labels.
3. **Correct** in Roboflow/CVAT/labelImg: add missing players, fix wrong boxes, remove false positives.
4. Export in **YOLO format**, one class “person” = 0.

This cuts labeling time (e.g. 1–2 min per image instead of 3–5). The final model is trained only on your (corrected) labels.

---

## 2. Dataset structure and format

### Folder layout (Ultralytics standard)

```
padel_person/
├── data.yaml      # path and class names
├── images/
│   ├── train/     # training images
│   │   ├── frame_0001.jpg
│   │   └── ...
│   └── val/
│       ├── frame_0100.jpg
│       └── ...
└── labels/
    ├── train/     # one .txt per image, same base name
    │   ├── frame_0001.txt
    │   └── ...
    └── val/
        ├── frame_0100.txt
        └── ...
```

Paths in `data.yaml` can be absolute or relative to the YAML file; the layout above is the usual convention.

### data.yaml

```yaml
path: /absolute/or/relative/path/to/padel_person
train: images/train
val: images/val

nc: 1
names: ['person']
```

- **path:** Root directory of the dataset (so `path/train` and `path/val` resolve correctly; for the layout above, `path` is `padel_person`).
- **nc: 1** — one class.
- **names: ['person']** — class 0 is “person”. Ultralytics will use index 0 for this class; CourtFlow uses `classes=[0]`.

### YOLO label format

- **One `.txt` file per image**, same base name as the image (e.g. `frame_0001.jpg` → `frame_0001.txt`).
- **One line per object.** Each line:  
  `class_id x_center y_center width height`  
  All in **normalized** coordinates (0–1), relative to image width/height.
- For your case, every line is:  
  `0 x_center y_center width height`  
  Example: `0 0.45 0.52 0.12 0.35`

So: **class index 0 = person** in both the dataset and the trained model.

---

## 3. Training (Ultralytics)

Use the [Ultralytics](https://docs.ultralytics.com/) CLI or Python API. **Fine-tuning from a pretrained checkpoint** is recommended (faster and usually better than training from scratch).

### Recommended: YOLO26 (if your Ultralytics supports it)

```bash
yolo detect train data=/path/to/padel_person/data.yaml model=yolo26n.pt epochs=80 imgsz=640 batch=16
```

- **data:** Path to your `data.yaml`.
- **model:** `yolo26n.pt` (nano), `yolo26s.pt`, or `yolo26m.pt`. Use `.pt` to fine-tune; use `.yaml` (e.g. `yolo26n.yaml`) to train from scratch (more epochs needed).
- **epochs:** 50–100 typical; for same-angle data, 60–80 often enough. Monitor val mAP; stop early if overfitting.
- **imgsz:** 640 is standard; 640 or 1280 both work in CourtFlow.
- **batch:** 8, 16, or 32 depending on GPU memory. Reduce if OOM.

Output weights (single file to use in CourtFlow):

- **Best (by mAP):** `runs/detect/train/weights/best.pt`
- **Last:** `runs/detect/train/weights/last.pt`

Use **best.pt** as your detection model.

### YOLOv8 (same idea)

```bash
yolo detect train data=/path/to/padel_person/data.yaml model=yolov8n.pt epochs=80 imgsz=640 batch=16
```

Same options: `yolov8n.pt` / `yolov8s.pt` / `yolov8m.pt`, etc. Weights in `runs/detect/train/weights/best.pt`.

### Confirm one class and class 0

- In `data.yaml` you have `nc: 1` and `names: ['person']` → class 0 is person.
- The trained `.pt` file will have a single class; Ultralytics keeps the same index, so **class 0 = person** in `best.pt`. CourtFlow calls `model.predict(..., classes=[0])`, so no change needed.

### Suggested hyperparameters (same-angle padel)

| Setting | Suggestion |
|--------|------------|
| **Epochs** | 60–80 (fine-tune); 100+ if training from `.yaml`. |
| **Batch size** | 16 if GPU allows; 8 for 8 GB VRAM. |
| **Image size** | 640. |
| **Model** | Start with `yolo26n.pt` or `yolov8n.pt`; move to `yolo26s`/`yolov8s` if you need better accuracy and have GPU headroom. |
| **Pretrained** | Use `.pt` (e.g. `yolo26n.pt`) to fine-tune; faster and usually better than from-scratch. |

---

## 4. Same camera angle: tips

Because all your match videos are from the same court/camera:

- **Train (and validate) only on that angle.** Don’t mix in very different views just to “add variety”; it can hurt accuracy for your fixed setup.
- **Train/val split:** Prefer splitting **by video/match**, not by random frames from one video. That way validation reflects unseen matches and avoids overfitting to one game.
- **Augmentation:** Use **light** augmentation (e.g. Ultralytics defaults: flips, small brightness/contrast). Avoid strong geometric changes (large rotation, extreme crop) that don’t match your fixed angle.
- **Overfitting:** With a single angle and limited data, the model can overfit. Use the built-in validation; if train mAP keeps rising while val mAP stalls or drops, stop early (or reduce epochs / add a bit more augmentation). **best.pt** is already the checkpoint with best val mAP, so you’re safe to use it.

---

## 5. Use your trained weights in CourtFlow

**CLI (run-match)**  
Pass the path to your `.pt` file:

```bash
python3 -m src.app.cli run-match --detection-model path/to/best.pt
```

Or with a path relative to the project root, e.g. `models/best.pt`:

```bash
python3 -m src.app.cli run-match --detection-model models/best.pt
```

**Environment variable**  
Set once so every run uses your model (no CLI flag):

```bash
export COURTFLOW_DETECTION_MODEL=/absolute/path/to/best.pt
python3 -m src.app.cli run-match
```

Or in `.env`:

```
COURTFLOW_DETECTION_MODEL=./models/best.pt
```

**Resolution order**  
1. `--detection-model` (CLI)  
2. `COURTFLOW_DETECTION_MODEL` (env)  
3. Pretrained `yolo26n.pt` / `yolov8n.pt` if neither is set.

---

## 6. Where to put the weights file in CourtFlow

After training (in the other repo or Colab), you only need to point CourtFlow at the **single `.pt` file**:

- **Option A:** Copy `best.pt` into CourtFlow, e.g. `CourtFlow-1/models/best.pt`, and use `--detection-model models/best.pt` or `COURTFLOW_DETECTION_MODEL=./models/best.pt`.
- **Option B:** Keep weights elsewhere (e.g. shared drive or training repo) and set `COURTFLOW_DETECTION_MODEL=/absolute/path/to/best.pt`.

Add `models/*.pt` to `.gitignore` if you don’t want to commit large weight files.

---

## 7. Contract (unchanged)

The custom model is loaded with `YOLO(path)`. CourtFlow still:

- Runs **person only** (`classes=[0]`).  
- Expects the same detection output format (bboxes, optional track IDs).  
- Uses the same tracking (BoT-SORT/ByteTrack) and ROI/ground-point logic.

So any Ultralytics YOLO weights trained for **person (class 0)** will work as a drop-in replacement for the default pretrained model.
