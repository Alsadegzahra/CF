#!/usr/bin/env python3
"""
Ingest a match video and run the full pipeline (non-interactive), then print match_id and UI URLs.

Example:
  python3 scripts/run_video_through_pipeline.py --input ~/Desktop/sample2.mp4 --court_id court_002
  python3 scripts/run_video_through_pipeline.py   # looks for sample2.mp4 in cwd and ~/Desktop
"""
from __future__ import annotations

import argparse
import re
import subprocess
import sys
from pathlib import Path
from typing import Optional

REPO_ROOT = Path(__file__).resolve().parents[1]


def _find_default_video() -> Optional[Path]:
    for p in (
        Path.cwd() / "sample2.mp4",
        REPO_ROOT / "sample2.mp4",
        Path.home() / "Desktop" / "sample2.mp4",
        Path.home() / "Downloads" / "sample2.mp4",
    ):
        if p.is_file():
            return p.resolve()
    return None


def _resolve_video_arg(raw: str) -> Path:
    """Expand ~, handle relative paths from cwd, resolve to absolute (file may or may not exist)."""
    p = Path(raw.strip()).expanduser()
    if not p.is_absolute():
        p = (Path.cwd() / p).resolve()
    else:
        try:
            p = p.resolve()
        except OSError:
            pass
    return p


def _case_insensitive_same_name(dir_path: Path, base_name: str) -> Optional[Path]:
    """If base_name not found, pick one file in dir_path whose name matches case-insensitively."""
    if not dir_path.is_dir():
        return None
    want = base_name.lower()
    for child in dir_path.iterdir():
        if child.is_file() and child.name.lower() == want:
            return child.resolve()
    return None


def main() -> None:
    ap = argparse.ArgumentParser(description="Ingest video + run-match; print dashboard URLs.")
    ap.add_argument(
        "--input",
        "-i",
        default="",
        help="Path to .mp4 (default: sample2.mp4 in cwd, repo root, Desktop, or Downloads)",
    )
    ap.add_argument("--court_id", default="court_002", help="Court id for ingest-match")
    ap.add_argument("--no-run-match", action="store_true", help="Only ingest; skip pipeline")
    args = ap.parse_args()

    raw_input = (args.input or "").strip()
    if raw_input:
        video = _resolve_video_arg(raw_input)
        if not video.is_file():
            # e.g. Sample2.mp4 on Desktop
            alt = _case_insensitive_same_name(video.parent, video.name)
            if alt and alt.is_file():
                video = alt
            else:
                print(
                    f"File not found: {raw_input}\n"
                    f"Resolved to: {video}\n"
                    f"Check the path (drag the file into Terminal to paste a full path).",
                    file=sys.stderr,
                )
                sys.exit(1)
    else:
        found = _find_default_video()
        if not found:
            print(
                "No video found. Pass --input /full/path/to/video.mp4\n"
                "Or place sample2.mp4 in: ./ , repo root, ~/Desktop/, or ~/Downloads/",
                file=sys.stderr,
            )
            sys.exit(1)
        video = found

    cli = [sys.executable, "-m", "src.app.cli", "ingest-match", "--court_id", args.court_id, "--input", str(video), "--no-calibrate-prompt"]
    r = subprocess.run(cli, cwd=REPO_ROOT, capture_output=True, text=True)
    sys.stdout.write(r.stdout)
    sys.stderr.write(r.stderr)
    if r.returncode != 0:
        sys.exit(r.returncode)

    m = re.search(r"FINALIZED\s+(match_\S+)\s+->", r.stdout)
    if not m:
        print("Could not parse match_id from ingest output.", file=sys.stderr)
        sys.exit(1)
    match_id = m.group(1)
    print(f"\n--- Match id: {match_id} ---\n")

    if not args.no_run_match:
        r2 = subprocess.run(
            [sys.executable, "-m", "src.app.cli", "run-match", "--match_id", match_id],
            cwd=REPO_ROOT,
        )
        if r2.returncode != 0:
            sys.exit(r2.returncode)

    print("\n--- Open the dashboard ---")
    print(f"  React (dev):  http://127.0.0.1:5173/?match_id={match_id}")
    print(f"  Classic view: http://127.0.0.1:8000/view?match_id={match_id}")
    print(f"  React (prod): http://127.0.0.1:8000/?match_id={match_id}   (after: npm run build + uvicorn)")
    print("\nTerminals: (1) uvicorn src.app.api:app --reload   (2) npm run dev")


if __name__ == "__main__":
    main()
