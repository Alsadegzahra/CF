#!/usr/bin/env python3
"""
Raspberry Pi: record a short clip with rpicam-vid (hardware H.264), upload to Cloudflare R2,
print a presigned GET URL. No CourtFlow pipeline.

Requires on Pi: rpicam-vid, boto3, python-dotenv, and ~/courtflow/.env with R2_* set.

Usage (on Pi):
  cd ~/courtflow
  ./scripts/pi_record_upload_r2.py
  # or: python3 scripts/pi_record_upload_r2.py --seconds 5
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
import tempfile
from pathlib import Path


def _repo_root() -> Path:
    return Path(os.environ.get("COURTFLOW_HOME", Path.home() / "courtflow")).resolve()


def main() -> int:
    parser = argparse.ArgumentParser(description="Record from Pi camera and upload MP4 to R2.")
    parser.add_argument("--seconds", type=float, default=5.0, help="Recording length (default 5)")
    parser.add_argument(
        "--prefix",
        default="pi_raw_clips/",
        help="R2 key prefix (default pi_raw_clips/)",
    )
    parser.add_argument(
        "--url-ttl",
        type=int,
        default=86400 * 7,
        help="Presigned URL lifetime in seconds (default 7 days)",
    )
    args = parser.parse_args()

    repo = _repo_root()
    if not repo.is_dir():
        print(f"ERROR: COURTFLOW_HOME / repo not found: {repo}", file=sys.stderr)
        return 1

    sys.path.insert(0, str(repo))
    os.environ["PYTHONPATH"] = str(repo)

    from dotenv import load_dotenv

    load_dotenv(repo / ".env")

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

    key = f"{args.prefix.rstrip('/')}/{tmp.name}"
    print(f"Uploading to R2 key: {key}", flush=True)
    upload_file(tmp, key=key)
    bucket = os.environ.get("R2_BUCKET")
    if not bucket:
        print("ERROR: R2_BUCKET not set in .env", file=sys.stderr)
        tmp.unlink(missing_ok=True)
        return 1

    url = get_signed_url(bucket, key, expiration_seconds=args.url_ttl)
    print("\nPresigned URL (open in browser):\n", url, sep="", flush=True)

    tmp.unlink(missing_ok=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
