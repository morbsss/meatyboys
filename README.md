# Meaty Boys Cup

A live fantasy rugby scoreboard for the Meaty Boys Cup league. Tracks weekly scores, league standings, and a two-bracket finals (Championship + Sacko) across the Super Rugby Pacific season.

---

## What it does

- **Scoreboard** - live player scores for the current round, updated every minute on game days
- **League Table** - win/loss standings across two conferences with live in-round scores applied
- **Finals** - bracket view for the Championship (top 4) and Sacko (bottom 4) finals, seeded from the live league table
- Data is pulled from [fantasyrugbydraft.com](http://www.fantasyrugbydraft.com) and the ESPN scoreboard API

---

## Tech stack

| Layer | What |
|---|---|
| Backend | Python 3 / Flask |
| Server | Gunicorn (1 worker, 4 threads) |
| Frontend | jQuery + Bootstrap 3 |
| Data | JSON files on disk, updated by cron |
| Deployment | SCP + bash via `deploy.ps1` (Windows) |

---

## Local development

**1. Clone and set up the environment**

```bash
git clone <repo-url>
cd meatyboys
python3 -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
```

**2. Create your `.env`**

```bash
cp .env.example .env
```

The defaults in `.env.example` work for local dev - no changes needed.

**3. Seed data (first run only)**

The app reads from JSON files in `data/`. Run the fetch script to populate them:

```bash
python scripts/fetch.py
```

This requires a valid `data/cookie.txt` (a session cookie from fantasyrugbydraft.com - run `get_cookie.py` first, or copy one manually from your browser).

**4. Start the app**

```bash
python app.py
```

Visit [http://127.0.0.1:5000](http://127.0.0.1:5000)

---

## Deploying to a VM

The project ships with a one-command deploy from Windows. It copies files over SCP and runs `deploy.sh` on the VM to install dependencies, set up cron jobs, and start gunicorn.

### Prerequisites

- A Linux VM (tested on Ubuntu/Debian) reachable via SSH
- Python 3.10+ on the VM
- OpenSSH on Windows (`ssh -V` to check - installed by default on Windows 10/11)

### Steps

**1. Edit `deploy.ps1`** - set your VM's IP and SSH username at the top of the file:

```powershell
$VM_IP    = "your.vm.ip.here"
$VM_USER  = "root"   # or ubuntu, etc.
```

**2. Create `.env.production`** - copy the example and fill in production values:

```bash
cp .env.example .env.production
```

```env
SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
DEBUG=false
HOST=0.0.0.0
PORT=5000
```

**3. Run the deploy script from PowerShell:**

```powershell
.\deploy.ps1
```

This will:
1. Create the app directories on the VM
2. Copy all app files, templates, scripts, and static data
3. Push `.env.production` to the VM as `.env`
4. Run `deploy.sh` on the VM (creates venv, installs packages, seeds data, installs cron jobs, starts gunicorn)

The app will be live at `http://<your-vm-ip>:5000`

### SSH key auth (optional but recommended)

To avoid typing your VM password on every deploy:

```powershell
ssh-keygen -t ed25519 -C "meatyboys-deploy"
Get-Content "$env:USERPROFILE\.ssh\id_ed25519.pub" | ssh root@your.vm.ip "mkdir -p ~/.ssh && cat >> ~/.ssh/authorized_keys && chmod 600 ~/.ssh/authorized_keys"
```

### Restarting gunicorn manually

```bash
fuser -k 5000/tcp
cd ~/meatyboys
nohup venv/bin/gunicorn -w 1 --threads 4 -b 0.0.0.0:5000 --access-logfile gunicorn.log app:app >> gunicorn.log 2>&1 &
```

---

## Scripts

All scripts live in `scripts/` and write JSON output to `data/`.

| Script | What it does |
|---|---|
| `get_cookie.py` | Refreshes the fantasyrugbydraft.com session cookie |
| `save_round.py` | Saves the current active round number |
| `get_player_scores.py` | Fetches live player scores for the current round |
| `save_scoreboard.py` | Pulls the ESPN Super Rugby Pacific scoreboard (real match scores) |
| `save_leaguetable.py` | Fetches league standings from fantasyrugbydraft.com |
| `save_draft.py` | Saves draft/squad data for each team |
| `save_current_season.py` | Saves season metadata |
| `fetch.py` | Runs all of the above in sequence (useful for a manual full refresh) |

---

## Cron jobs

Data is kept fresh by cron. See `cron.txt` for the full schedule. Key frequencies:

| What | Fri/Sat/Sun (game days) | Mon–Thu |
|---|---|---|
| Player scores | Every 3 min | Every 2 hrs |
| Scoreboard | Every minute | Every 2 hrs |
| League table | Every minute | Every 2 hrs |
| Round | Every 20 min | Every 20 min (Thu only) |
| Cookie refresh | 5 pm daily | 5 pm daily |

To install cron jobs on the VM (done automatically by `deploy.sh`):

```bash
crontab cron.txt
```

Logs go to `~/meatyboys/cron.log`.

---

## Finals format

Seedings are taken from the live league table at the time of the round.

**Championship bracket** (top 4)
- Semi 1: #1 vs #4
- Semi 2: #2 vs #3
- Rounds 14 & 15 are the semis - aggregate score over both rounds decides who advances
- Round 16 is the final - highest score wins the Championship

**Sacko bracket** (bottom 4)
- Semi 1: #7 vs #10
- Semi 2: #8 vs #9
- Same two-round aggregate format, but the **loser** advances
- Round 16 Sacko final - lowest score is crowned Sacko

---

## Project structure

```
meatyboys/
├── app.py                  # Flask app + all API routes
├── config.py               # Env-based config (reads .env)
├── requirements.txt
├── deploy.ps1              # Windows → VM deploy script
├── deploy.sh               # VM setup + gunicorn start
├── cron.txt                # Cron schedule (install with: crontab cron.txt)
├── .env.example            # Config template
├── templates/              # Jinja2 HTML templates
│   ├── index.html          # Scoreboard
│   ├── leaguetable.html    # League table
│   ├── finals.html         # Finals bracket
│   └── draft.html          # Draft day tool
├── public/                 # Static assets served by Flask
│   ├── javascripts/        # jQuery, Bootstrap, app JS
│   ├── stylesheets/
│   └── images/
├── scripts/                # Data fetch scripts (run by cron)
├── data/                   # JSON data files (gitignored, written by scripts)
└── playerfiles/            # Draft state files (gitignored)
```
