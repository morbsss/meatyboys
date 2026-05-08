"""Fetch the current season schedule from Fox Sports and save it."""
import json
import os

import requests

ROOT = os.path.join(os.path.dirname(__file__), '..')
DATA_DIR = os.path.join(ROOT, 'data')

USER_KEY = 'A00239D3-45F6-4A0A-810C-54A347F144C2'

games_resp = requests.get(
    f'https://statsapi.foxsports.com.au/3.0/api/scores/completeandupcoming.json'
    f';ts=1613179454679;past=false;sport=rugby:29,30?limit=50&userkey={USER_KEY}',
    timeout=15,
)
games = games_resp.json()

profiles_resp = requests.get(
    f'https://statsapi.foxsports.com.au/3.0/api/scoreboard/profiles/foxsports_rugby.json'
    f';masthead=foxsports?userkey={USER_KEY}',
    timeout=15,
)
body2 = profiles_resp.json()

live_au = body2[0]['series_scoreboards'][0]['scoreboards']
live_nz = body2[0]['series_scoreboards'][2]['scoreboards']
live = live_au + live_nz

for live_entry in live:
    found = False
    for i, game in enumerate(games):
        if live_entry['match_centre_url']['match_id'] == game.get('match_id'):
            found = True
            break
    if not found:
        splice_loc = 0
        new_entry = {}
        for i, game in enumerate(games):
            if live_entry['score']['match_start_date'] < game.get('match_start_date', ''):
                splice_loc = i
                new_entry = live_entry['score']
                break
        games.insert(splice_loc, new_entry)

out_path = os.path.join(DATA_DIR, 'currentseason.json')
with open(out_path, 'w') as f:
    json.dump(games, f)

print('Saved!')
