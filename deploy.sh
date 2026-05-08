#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# Production startup script — run this on your VM after cloning the repo.
#
# BEFORE RUNNING:
#   1. Copy .env.example to .env and fill in your production values:
#        cp .env.example .env
#        nano .env          ← set SECRET_KEY, DEBUG=false, HOST, PORT
#
#   2. Create a virtual environment (first time only):
#        python3 -m venv .venv
#
#   3. Then run this script:
#        bash deploy.sh
#
# VM SSH:  ssh <USERNAME>@<YOUR_VM_IP> -p <YOUR_SSH_PORT>   ← fill in your VM details
# App URL: http://<YOUR_VM_IP>:<PORT>                        ← fill in your VM IP + PORT
# ─────────────────────────────────────────────────────────────────────────────

set -e
cd "$(dirname "$0")"

# Activate virtual environment
source .venv/bin/activate

# Install / update Python dependencies
pip install -r requirements.txt

# Create data directories if they don't exist yet
mkdir -p data playerfiles

# ─── gunicorn ─────────────────────────────────────────────────────────────────
# -w 1          : single worker — required so the draft timer runs in one process
# --threads 4   : 4 threads for concurrent requests
# -b            : bind address (HOST and PORT come from .env)
# --access-logfile - : log requests to stdout
# ─────────────────────────────────────────────────────────────────────────────

export $(grep -v '^#' .env | xargs)   # load .env into shell environment

gunicorn \
    -w 1 \
    --threads 4 \
    -b "${HOST:-0.0.0.0}:${PORT:-3000}" \
    --access-logfile - \
    app:app
