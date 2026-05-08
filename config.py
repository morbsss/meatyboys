"""
App configuration — imported by app.py.

━━━ LOCAL DEVELOPMENT ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  1. cp .env.example .env
  2. python app.py
  App runs at http://127.0.0.1:3000

━━━ PRODUCTION (VM) ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Fill in the PRODUCTION values in .env (or export them as env vars), then:
  bash deploy.sh

  Important: always use --workers 1 with gunicorn so the draft timer
  background thread runs in a single process.
"""
import os
from pathlib import Path

# Load .env file if python-dotenv is installed (used in both local and VM)
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # fall back to actual environment variables

BASE_DIR = Path(__file__).parent


# ── Flask ──────────────────────────────────────────────────────────────────────

# PRODUCTION ▶ set to a long random string — never commit the real value
# Generate: python -c "import secrets; print(secrets.token_hex(32))"
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')

# PRODUCTION ▶ set to false
DEBUG = os.getenv('DEBUG', 'true').lower() == 'true'


# ── Server ─────────────────────────────────────────────────────────────────────

# PRODUCTION ▶ change to '0.0.0.0' to accept connections on all interfaces
HOST = os.getenv('HOST', '127.0.0.1')

# PRODUCTION ▶ set to the open port on your VM (e.g. 8080, 5000, 80)
PORT = int(os.getenv('PORT', '3000'))


# ── Data paths ─────────────────────────────────────────────────────────────────

# PRODUCTION ▶ override if you deploy outside the project root on the VM
DATA_DIR        = Path(os.getenv('DATA_DIR',        str(BASE_DIR / 'data')))
PLAYERFILES_DIR = Path(os.getenv('PLAYERFILES_DIR', str(BASE_DIR / 'playerfiles')))
