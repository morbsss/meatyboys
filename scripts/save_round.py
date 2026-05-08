"""Determine the current round from the season schedule and save it."""
import json
import os
from datetime import datetime, timezone

ROOT = os.path.join(os.path.dirname(__file__), '..')
DATA_DIR = os.path.join(ROOT, 'data')


def convert_date(date_str):
    parts = date_str.split('/')
    day = parts[0].zfill(2)
    month = parts[1].zfill(2)
    year_time = parts[2].split(' ')
    return f'{year_time[0]}-{month}-{day}T{year_time[1]}'


with open(os.path.join(DATA_DIR, 'currentseason.json')) as f:
    data = json.load(f)

now = datetime.now(timezone.utc)
of_round = {}

for i, entry in enumerate(data):
    game_date = datetime.fromisoformat(convert_date(entry['datetime']))
    if game_date.tzinfo is None:
        game_date = game_date.replace(tzinfo=timezone.utc)
    less_three_days = game_date.timestamp() - (60 * 60 * 24 * 3)
    if less_three_days > now.timestamp():
        of_round = data[i - 1]['round']
        break

print(of_round)
result = {'round': of_round, 'official': of_round}
with open(os.path.join(DATA_DIR, 'round.json'), 'w') as f:
    json.dump(result, f)

print('Saved!')
