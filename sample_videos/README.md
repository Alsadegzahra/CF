# Sample videos

Drop match videos here (`.mp4`/`.mov` are gitignored). Then from project root:

```bash
python3 -m src.app.cli ingest-match --court_id court_001 --input sample_videos/your_video.mp4 --no-calibrate-prompt
python3 -m src.app.cli run-match
```

Use **`--no-calibrate-prompt`** so ingest does not stop for “Define court points?” (good for scripts and screen recordings). Calibrate the court once per court with `calibrate-court` if needed.

See [README](../README.md) for full pipeline.
