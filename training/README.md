# Training YOLO for padel player detection (Colab)

This folder holds a **standalone Colab notebook** for training a person-detection YOLO model. No CourtFlow code runs here.

## Use in Google Colab

1. Open [Google Colab](https://colab.research.google.com).
2. **File → Upload notebook** and choose `padel_yolo_train_colab.ipynb` (from this repo), or copy its cells into a new notebook.
3. **Runtime → Change runtime type → GPU.**
4. Prepare your dataset (see [docs/DETECTION_TRAINING.md](../docs/DETECTION_TRAINING.md)): YOLO format, one class `person` = 0, in a folder with `data.yaml`, `images/train`, `images/val`, `labels/train`, `labels/val`. Zip it as `padel_person.zip` for upload.
5. Run the notebook: install Ultralytics → upload zip (or mount Drive and set dataset path) → train → download **best.pt**.
6. Copy **best.pt** into CourtFlow at `models/best.pt` and run with `--detection-model models/best.pt`.

Full guide (data, format, training options): **[docs/DETECTION_TRAINING.md](../docs/DETECTION_TRAINING.md)**.
