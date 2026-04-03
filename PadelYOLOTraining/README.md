# Padel player detection – YOLO training (standalone)

**This folder is separate from CourtFlow.** Use it to train a person-detection YOLO model in Google Colab. No CourtFlow code or repo is required.

## How to use it outside CourtFlow

1. **Copy this whole folder** anywhere you like (e.g. Desktop, a separate repo, or a cloud drive):
   - Copy the folder `PadelYOLOTraining` (this folder) so you have:
     - `PadelYOLOTraining/README.md`
     - `PadelYOLOTraining/padel_yolo_train_colab.ipynb`
2. Open [Google Colab](https://colab.research.google.com).
3. **File → Upload notebook** and choose `padel_yolo_train_colab.ipynb` from the copied folder.
4. In Colab: **Runtime → Change runtime type → GPU**.
5. Prepare your dataset (YOLO format, one class `person` = 0). See **Dataset format** below. Zip it as `padel_person.zip`.
6. Run the notebook: install Ultralytics → upload zip (or use Google Drive) → train → download **best.pt**.

When training is done, you have a single file **best.pt**. Use it in any app that expects a YOLO person-detection model (e.g. CourtFlow: put `best.pt` in `models/` and run with `--detection-model models/best.pt`).

---

## Dataset format

Your dataset must be in **YOLO format**, **one class: person**, with **class index 0**.

**Folder layout:**

```
padel_person/
├── data.yaml
├── images/
│   ├── train/   (.jpg etc.)
│   └── val/
└── labels/
    ├── train/   (.txt, one per image, same base name)
    └── val/
```

**data.yaml** (example):

```yaml
path: /path/to/padel_person
train: images/train
val: images/val
nc: 1
names: ['person']
```

**Labels:** One `.txt` per image. Each line: `0 x_center y_center width height` (normalized 0–1). Class `0` = person.

You can create this from your padel videos (extract frames with ffmpeg, annotate with Roboflow/CVAT/labelImg, export YOLO with one class “person”).
