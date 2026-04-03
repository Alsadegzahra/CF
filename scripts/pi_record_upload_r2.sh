#!/usr/bin/env bash
# Wrapper: use CourtFlow venv if present, then run pi_record_upload_r2.py
set -euo pipefail
REPO="${COURTFLOW_HOME:-$HOME/courtflow}"
cd "$REPO"
if [[ -x venv/bin/python3 ]]; then
  exec venv/bin/python3 scripts/pi_record_upload_r2.py "$@"
fi
exec python3 scripts/pi_record_upload_r2.py "$@"
