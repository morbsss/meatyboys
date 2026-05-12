"""Determine the current round from the season schedule and save it."""
import json
import os
from datetime import datetime, timedelta, timezone

ROOT = os.path.join(os.path.dirname(__file__), '..')
DATA_DIR = os.path.join(ROOT, 'data')


def convert_date(date_str):
    parts = date_str.split('/')
    day = parts[0].zfill(2)
    month = parts[1].zfill(2)
    year_time = parts[2].split(' ')
    return f'{year_time[0]}-{month}-{day}T{year_time[1]}'


def week_cutoff(game_dt):
    """Monday 07:00 AEST (= Sunday 21:00 UTC) of the week containing game_dt."""
    monday = game_dt.date() - timedelta(days=game_dt.weekday())
    return datetime(monday.year, monday.month, monday.day, tzinfo=timezone.utc) - timedelta(hours=3)


with open(os.path.join(DATA_DIR, 'currentseason.json')) as f:
    raw = json.load(f)

now = datetime.now(timezone.utc)

# Keep only the first game datetime per round
seen_rounds = {}
for entry in raw:
    r = entry['round']
    dt = datetime.fromisoformat(convert_date(entry['datetime'])).replace(tzinfo=timezone.utc)
    if r not in seen_rounds or dt < seen_rounds[r]:
        seen_rounds[r] = dt

entries = sorted(seen_rounds.items(), key=lambda x: x[1])  # [(round, datetime), ...]

of_round = entries[-1][0]
for i, (rnd, game_dt) in enumerate(entries):
    if week_cutoff(game_dt) > now:
        of_round = entries[i - 1][0] if i > 0 else entries[0][0]
        break

print(of_round)
result = {'round': of_round, 'official': of_round}
with open(os.path.join(DATA_DIR, 'round.json'), 'w') as f:
    json.dump(result, f)

print('Saved!')
