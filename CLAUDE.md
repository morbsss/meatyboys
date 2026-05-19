# Meaty Boys Cup — Project Guide

## What This Project Is

**Meaty Boys Cup** is a live fantasy rugby scoreboard web app for a private league competition. It tracks real-time player scores, conference league standings, and a two-bracket finals system (Championship for top 4, Sacko for bottom 4), with data sourced from fantasyrugbydraft.com and ESPN's Super Rugby Pacific API.

**Production URL:** http://meatyboys.com

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3 / Flask |
| WSGI Server | Gunicorn (1 worker, 4 threads) |
| Reverse Proxy | nginx (port 80 → Gunicorn port 5000) |
| Frontend | jQuery 3.2.0 + Bootstrap 3.3.7 |
| Data Storage | JSON files on disk (no database) |
| Scheduling | Linux cron jobs |
| External Data | fantasyrugbydraft.com (scraping) + ESPN API |
| Deployment | PowerShell (Windows) → SCP + bash (Linux VM) |

**VM:** `149.28.178.14` (root user), app lives at `~/meatyboys`

---

## Project Structure

```
meatyboys/
├── app.py                    # Main Flask app — routes, live scoring logic, draft timer
├── config.py                 # Environment config (reads .env)
├── requirements.txt          # Python dependencies
├── deploy.ps1                # Windows deployment script (SCP + SSH)
├── deploy.sh                 # VM setup script (venv, cron, gunicorn, nginx)
├── cron.txt                  # Cron schedule template (paths substituted at deploy)
├── nginx/
│   └── meatyboys.conf        # nginx reverse proxy config
├── templates/                # Jinja2 HTML templates
│   ├── index.html            # Scoreboard (live player scores)
│   ├── leaguetable.html      # League table with live in-round scores
│   ├── finals.html           # Finals bracket
│   └── draft.html            # Draft day timer/picker tool
├── public/                   # Static assets (JS, CSS, images)
│   ├── javascripts/
│   │   ├── main.js           # Scoreboard JS
│   │   ├── leaguetable.js    # League table JS
│   │   ├── finals.js         # Finals JS
│   │   └── draft.js          # Draft day JS
│   └── stylesheets/
├── scripts/                  # Cron-driven data fetch scripts
│   ├── fetch.py              # Master runner (calls all scripts in order)
│   ├── get_cookie.py         # Refreshes fantasyrugbydraft session cookie
│   ├── save_round.py         # Determines current round number
│   ├── save_draft.py         # Fetches full player hub (~480 players, 30 pages)
│   ├── get_player_scores.py  # Updates player scores for current round
│   ├── save_scoreboard.py    # Fetches real match scores from ESPN API
│   └── save_leaguetable.py   # Fetches league standings
├── data/                     # Generated JSON data files (gitignored)
│   ├── round.json            # Current round number
│   ├── leaguetable.json      # League standings (conferences + teams)
│   ├── draft{N}.json         # Player data + scores for round N
│   ├── scoreboard{N}.json    # Real match scores for round N
│   ├── fixtures.json         # Matchup schedule + live window
│   ├── currentseason.json    # Season game dates
│   └── cookie.txt            # Session cookie for fantasyrugbydraft
├── playerfiles/              # Draft day state files (gitignored)
│   ├── time.txt              # Draft timer state
│   ├── allplayers.txt        # Remaining available players
│   └── users.txt             # User draft state
└── reference/                # Old project reference files (NOT integrated — needs cleanup)
    └── README.md             # Describes planned use of reference files
```

---

## Frontend Pages & API Endpoints

### Pages

| Route | Template | Purpose |
|---|---|---|
| `/` | `index.html` | Live player scores for current round |
| `/leaguetable` | `leaguetable.html` | Win/loss standings with live in-round scores |
| `/finals` | `finals.html` | Championship & Sacko brackets |
| `/Draft` | `draft.html` | Draft day timer and player selection |

### Key API Endpoints

| Endpoint | Description |
|---|---|
| `GET /getRound` | Current round number |
| `GET /getLeagueTable` | Raw league standings |
| `GET /getLiveTable` | League table with live current-round scores applied |
| `POST /getDraft` | Player scores for a given round |
| `GET /getScoreboard/{round}` | ESPN match scores for a round |
| `GET /getFinalsData` | Computed finals bracket with live scores |
| `GET /getcurrSeason` | Season schedule and game dates |

---

## Data Architecture

All data lives in flat JSON files in `data/` — there is no SQL database. Scripts write JSON; Flask reads and serves it. A `threading.Lock` in `app.py` makes file I/O thread-safe.

### Cron Schedule

Scripts run on two cadences: high-frequency on game days (Fri–Mon), low-frequency mid-week (Tue–Thu).

| Script | Game days | Mid-week |
|---|---|---|
| `get_player_scores.py` | Every 3 min | Every 2 hrs |
| `save_scoreboard.py` | Every 1 min | Every 2 hrs |
| `save_leaguetable.py` | Every 1 min | Every 2 hrs |
| `save_draft.py` | Every 1 hr | Every 2 hrs |
| `save_round.py` | Every 20 min | Every 20 min (Thu) |
| `get_cookie.py` | 5 pm daily | 5 pm daily |

---

## Key Business Logic

**Live Scoring (`/getLiveTable`):** Applies current-round draft scores to each team's season record. Teams ranked 1–10 across both conferences by W-L-T then pointsFor. Freezes once round ≥ 14 (finals).

**Finals Seeding:** Top 4 teams → Championship bracket. Bottom 4 → Sacko bracket. Semis use 2-round aggregate (rounds 14–15). Championship: higher score advances. Sacko: lower score advances (deliberate — it's a loser bracket). Finals in round 16.

**Draft Day Timer:** 92-second per-pick timer. Snake draft (direction alternates). Background thread in `app.py` auto-advances when timer expires. 10 hardcoded users.

---

## Deployment

From Windows, run `.\deploy.ps1`. This SCPs files to the VM and SSHes in to run `deploy.sh`, which:
1. Creates Python venv and installs requirements
2. Seeds initial data via `fetch.py`
3. Installs cron jobs from `cron.txt` (paths auto-substituted)
4. Starts Gunicorn (single worker for draft timer thread safety)
5. Configures nginx reverse proxy

**Manual Gunicorn restart on VM:**
```bash
fuser -k 5000/tcp
cd ~/meatyboys
nohup venv/bin/gunicorn -w 1 --threads 4 -b 0.0.0.0:5000 --access-logfile gunicorn.log app:app >> gunicorn.log 2>&1 &
```

---

## Current Development Track: Data Analysis Feature

**Branch:** `nathan-dev`

### Goal

Build a new data pipeline and web UI that replaces an old email-based analysis workflow. The reference files in `reference/` are from the old project and capture the original approach.

### Planned Stages

1. **Data sourcing** — Extract data from a target website (scraping or API)
2. **Manipulation** — Clean and transform raw data into a usable structure
3. **Analysis** — Derive insights from the processed data
4. **Presentation** — Surface analysis results on the existing Meaty Boys website as:
   - A new frontend page with a sortable/filterable data table
   - Optionally, a dashboard with charts and summary stats

### Integration Approach

- New cron script(s) in `scripts/` to handle fetch + analysis, writing output to `data/`
- New Flask route(s) in `app.py` to serve the processed data as JSON
- New template in `templates/` for the analysis page
- New JS file in `public/javascripts/` for the frontend table/dashboard
- Navigation updated to include the new page

### Reference Files

`reference/` contains old project code that implemented the data extraction and email-sending flow. These files **need significant cleanup** before any code is reused. Treat them as reference only — do not import or run them directly.

---

## Environment Config

Copy `.env.example` to `.env` for local dev. For production, `.env.production` is created separately and not committed.

Key variables:
- `SECRET_KEY` — Flask secret key
- `DEBUG` — `true` for dev, `false` for prod
- `HOST` / `PORT` — bind address (loopback in prod, nginx fronts port 80)
