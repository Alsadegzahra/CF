#!/usr/bin/env python3
"""
Raspberry Pi: record a short clip with rpicam-vid (hardware H.264), upload to Cloudflare R2.
No CourtFlow pipeline (no tracking, report.json, or heatmaps).

By default the object is stored like a normal match folder so it shows up in the R2 UI:
  matches/<match_id>/raw/match.mp4
You do not need report.json for that — Cloudflare only lists objects by key.

The hosted /view dashboard still expects report.json if you want the web app; raw-only
uploads are for storage / later ingest.

Requires on Pi: rpicam-vid, boto3. R2_* in the environment (see pi_record_upload_r2.sh).

Usage (on Pi):
  ./scripts/pi_record_upload_r2.sh
  ./scripts/pi_record_upload_r2.sh --match-id match_2026_04_01_manual
  ./scripts/pi_record_upload_r2.sh --print-url
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import tempfile
from datetime import datetime
from pathlib import Path


def _repo_root() -> Path:
    return Path(os.environ.get("COURTFLOW_HOME", Path.home() / "courtflow")).resolve()


def main() -> int:
    parser = argparse.ArgumentParser(description="Record from Pi camera and upload MP4 to R2.")
    parser.add_argument("--seconds", type=float, default=5.0, help="Recording length (default 5)")
    parser.add_argument(
        "--match-id",
        default=None,
        help="R2 folder name under matches/ (default: match_YYYY_MM_DD_HHMMSS)",
    )
    parser.add_argument(
        "--key-prefix",
        choices=("match", "flat"),
        default="match",
        help="match: matches/<id>/raw/match.mp4 (default, same tree as CourtFlow). "
        "flat: use --flat-prefix only.",
    )
    parser.add_argument(
        "--flat-prefix",
        default="pi_raw_clips",
        help="With --key-prefix flat: R2 key is <flat-prefix>/<unique>.mp4",
    )
    parser.add_argument(
        "--print-url",
        action="store_true",
        help="Also print a presigned GET URL (default: off — use R2 dashboard only)",
    )
    parser.add_argument(
        "--url-ttl",
        type=int,
        default=86400 * 7,
        help="Presigned URL lifetime if --print-url (default 7 days)",
    )
    args = parser.parse_args()

    repo = _repo_root()
    if not repo.is_dir():
        print(f"ERROR: COURTFLOW_HOME / repo not found: {repo}", file=sys.stderr)
        return 1

    sys.path.insert(0, str(repo))
    os.environ["PYTHONPATH"] = str(repo)

    duration = f"{args.seconds:g}s"
    tmp = Path(tempfile.gettempdir()) / f"cf_pi_{os.getpid()}.mp4"

    # Hardware H.264 on Pi; no ffmpeg re-encode. Container is MP4 for browsers.
    cmd = [
        "rpicam-vid",
        "-t",
        duration,
        "-o",
        str(tmp),
        "--codec",
        "h264",
    ]
    print("Recording:", " ".join(cmd), flush=True)
    try:
        subprocess.run(cmd, check=True)
    except FileNotFoundError:
        print("ERROR: rpicam-vid not found. Install rpicam-apps (Bookworm/Trixie).", file=sys.stderr)
        return 1
    except subprocess.CalledProcessError as e:
        print(f"ERROR: rpicam-vid failed (exit {e.returncode})", file=sys.stderr)
        return 1

    if not tmp.exists() or tmp.stat().st_size == 0:
        print("ERROR: output file missing or empty.", file=sys.stderr)
        return 1

    from src.cloud.storage_r2 import get_signed_url, upload_file

    bucket = os.environ.get("R2_BUCKET")
    if not bucket:
        print("ERROR: R2_BUCKET not set in environment (export R2_* or use pi_record_upload_r2.sh)", file=sys.stderr)
        tmp.unlink(missing_ok=True)
        return 1

    if args.key_prefix == "match":
        mid = args.match_id or f"match_{datetime.now().strftime('%Y_%m_%d_%H%M%S')}"
        if not re.match(r"^[a-zA-Z0-9_.-]+$", mid):
            print("ERROR: --match-id may only contain letters, digits, ._-", file=sys.stderr)
            tmp.unlink(missing_ok=True)
            return 1
        key = f"matches/{mid}/raw/match.mp4"
    else:
        mid = None
        key = f"{args.flat_prefix.strip('/')}/{tmp.name}"

    print(f"Uploading to R2: s3://{bucket}/{key}", flush=True)
    upload_file(tmp, key=key)

    print("\nDone. Cloudflare dashboard → R2 → your bucket → browse objects.", flush=True)
    if mid is not None:
        print(f"   Match folder: matches/{mid}/raw/match.mp4", flush=True)
    else:
        print(f"   Key: {key}", flush=True)

    if args.print_url:
        url = get_signed_url(bucket, key, expiration_seconds=args.url_ttl)
        print("\nPresigned URL:\n", url, sep="", flush=True)

    tmp.unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
