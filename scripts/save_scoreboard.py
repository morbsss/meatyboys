"""Fetch Super Rugby scores from ESPN for the current round and save them."""
import json
import os
from datetime import datetime, timezone

import requests

ROOT = os.path.join(os.path.dirname(__file__), '..')
DATA_DIR = os.path.join(ROOT, 'data')


def convert_date(date_str):
    parts = date_str.split('/')
    day = parts[0].zfill(2)
    month = parts[1].zfill(2)
    year_time = parts[2].split(' ')
    return f'{year_time[0]}-{month}-{day}T{year_time[1]}'


with open(os.path.join(DATA_DIR, 'round.json')) as f:
    round_no = json.load(f)['round']

with open(os.path.join(DATA_DIR, 'currentseason.json')) as f:
    curr_seas = json.load(f)

round_dates = []
for entry in curr_seas:
    if entry['round'] == round_no:
        try:
            dt = datetime.fromisoformat(convert_date(entry['datetime']))
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            round_dates.append(dt)
        except ValueError:
            pass

# Deduplicate by calendar day
seen_days = set()
unique_dates = []
for d in round_dates:
    key = d.date()
    if key not in seen_days:
        seen_days.add(key)
        unique_dates.append(d)

# Filter out invalid dates
unique_dates = [d for d in unique_dates if d.year > 1]

score_arr = []

if not unique_dates:
    out_path = os.path.join(DATA_DIR, f'scoreboard{round_no}.json')
    with open(out_path, 'w') as f:
        json.dump(score_arr, f)
    print(f'Saved! (no valid dates for round {round_no})')
else:
    completed = 0
    for d in unique_dates:
        date_tag = d.strftime('%Y%m%d')
        base_url = (
            'https://site.web.api.espn.com/apis/site/v2/sports/rugby/scorepanel'
            f'?contentorigin=espn&dates={date_tag}&lang=en'
        )
        try:
            leg = {}
            for region in ('au', 'us', 'gb'):
                resp = requests.get(base_url + f'&region={region}', timeout=15)
                body = resp.json()
                for item in body.get('scores', []):
                    leagues = item.get('leagues', [])
                    if leagues and leagues[0].get('name') == 'Super Rugby Pacific':
                        leg = item
                        break
                if leg:
                    break
            comps = leg.get('events') or []
            for comp in comps:
                competitors = comp['competitions'][0]['competitors']
                score_arr.append(competitors[0])
                score_arr.append(competitors[1])
        except Exception as e:
            print(f'Scoreboard API error for {date_tag}: {e}')
        completed += 1

    print(score_arr)
    out_path = os.path.join(DATA_DIR, f'scoreboard{round_no}.json')
    with open(out_path, 'w') as f:
        json.dump(score_arr, f)
    print('Saved!')
