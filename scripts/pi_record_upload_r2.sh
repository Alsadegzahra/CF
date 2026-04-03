#!/usr/bin/env bash
# Load R2 (and optional) vars from a file into the environment, then run Python.
# No .env reading inside Python — credentials are exported before the interpreter starts.
#
# Default file: $REPO/.env  Override: R2_ENV_FILE=/path/to/file ./scripts/pi_record_upload_r2.sh
# File format: KEY=value lines (same as .env). Use quotes if values have spaces.
set -euo pipefail
REPO="${COURTFLOW_HOME:-$HOME/courtflow}"
cd "$REPO"

ENV_FILE="${R2_ENV_FILE:-$REPO/.env}"
if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

PY=python3
if [[ -x venv/bin/python3 ]]; then
  PY=venv/bin/python3
fi
exec "$PY" scripts/pi_record_upload_r2.py "$@"
