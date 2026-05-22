"""Fetch the full player hub for the current round from fantasyrugbydraft.com."""
import json
import os
import re
import sys
from html import unescape

import requests

ROOT = os.path.join(os.path.dirname(__file__), '..')
DATA_DIR = os.path.join(ROOT, 'data')

# Load credentials from .env (cron jobs don't inherit a shell environment)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, '.env'))
except ImportError:
    pass

LEAGUE_ID = os.environ["FRD_LEAGUE_ID"]
SEASON_ID = os.environ["FRD_SEASON_ID"]

with open(os.path.join(DATA_DIR, 'round.json')) as f:
    round_no = json.load(f)['round']

with open(os.path.join(DATA_DIR, 'cookie.txt')) as f:
    cookie = f.read().strip()

headers = {'Cookie': cookie}


def get_matchups():
    resp = requests.get('http://fantasyrugbydraft.com/matchup/Meaty_Boys_6', headers=headers, timeout=15)
    body = resp.text
    match_ids = []
    start = 0
    for _ in range(5):
        pos = body.find('matchupid', start)
        if pos == -1:
            break
        match_ids.append(body[pos + 11:pos + 47])
        start = pos + 47
    return match_ids


def get_playing(matchup_id, rnd):
    payload = {
        'Data': json.dumps({
            'leagueid': LEAGUE_ID,
            'matchupid': matchup_id,
            'gameweekid': str(rnd),
            'action': 'member/homepage/matchup',
            'type': 'control',
        })
    }
    resp = requests.post(
        'http://www.fantasyrugbydraft.com/Web/Services/Action.asmx/Request',
        json=payload,
        headers=headers,
        timeout=15,
    )
    content = json.loads(resp.json()['d'])['Content']
    players = []
    begin = 0
    while begin != -1:
        pos_start = content.find('playername', begin)
        if pos_start == -1:
            break
        pos_end = content.find('>', pos_start + 10)
        player = content[pos_start + 12:pos_end - 1]
        player = player.replace('&#39;', "'")
        players.append(player)
        begin = content.find('playername', pos_end + 5)
    return players


def get_page(page_no, rnd, playing):
    payload = {
        'Data': json.dumps({
            'filter': '',
            'leagueid': LEAGUE_ID,
            'gameweek': rnd,
            'category': '255',
            'seasons': SEASON_ID,
            'owner': '256',
            'position': 256,
            'teamnews': '256',
            'sort': '',
            'pageno': page_no,
            'action': 'member/league/playerhub',
            'type': 'control',
        })
    }
    resp = requests.post(
        'http://www.fantasyrugbydraft.com/Web/Services/Action.asmx/Request',
        json=payload,
        headers=headers,
        timeout=30,
    )
    content = json.loads(resp.json()['d'])['Content']

    players = []
    begin = content.find('</th>')
    begin = content.find('<tr>', begin)
    while begin != -1:
        pos_start = content.find('<td>', begin)
        pos_end = content.find('<', pos_start + 4)
        position = content[pos_start + 4:pos_end]

        index_temp = content.find('<td>', pos_end)
        id_start = content.find('playerid', index_temp + 4)
        id_end = content.find('playername', id_start)
        player_id = content[id_start + 10:id_end - 2].strip()

        play_start = content.find('>', index_temp + 4)
        play_end = content.find('<', play_start)
        player_name = content[play_start + 1:play_end].strip()

        if not player_name or player_name == ' ':
            begin = content.find('<td>', index_temp + 6)
            continue

        team_start = content.find('<td>', play_end)
        team_end = content.find('<', team_start + 4)
        team = content[team_start + 4:team_end]

        user_start = content.find('<td>', team_end)
        user_end = content.find('<', user_start + 4)
        user_name = content[user_start + 4:user_end]

        index_temp2 = content.find('<td>', user_end)
        score_start = content.find('<td>', index_temp2 + 4)
        score_end = content.find('<', score_start + 4)
        score = content[score_start + 4:score_end]

        tn_start = content.find('<td', score_end + 4)
        tn_end = content.find('<', tn_start + 4)
        tn = content[tn_start + 4:tn_end]

        begin = content.find('<td>', score_end)

        tn = tn[37:len(tn) - 13]
        team = team[14:]
        position = position[14:]
        score = score[14:]
        user_name = user_name[14:]

        bench = player_name not in playing

        players.append({
            'playerName': player_name,
            'team': team,
            'userName': user_name,
            'bench': bench,
            'score': score,
            'position': position,
            'teamNews': tn,
            'playerId': player_id,
        })

    return players


# Determine actual round to use
target_round = int(sys.argv[2]) if (len(sys.argv) > 2 and sys.argv[1] == '0') else round_no

matchup_ids = get_matchups()
playing = []
for mid in matchup_ids:
    playing.extend(get_playing(mid, target_round))

all_matches = []
for page in range(16):
    print(f'{target_round}+{page}')
    all_matches.extend(get_page(page, target_round, playing))

front_row_count = sum(1 for p in all_matches if p['position'] == 'Front Row')
if front_row_count > 5:
    existing_path = os.path.join(DATA_DIR, f'draftPlayers{target_round}.json')
    try:
        with open(existing_path) as f:
            existing = json.load(f)
        if len(all_matches) >= len(existing):
            with open(existing_path, 'w') as f:
                json.dump(all_matches, f)
            print(f'Saved! {target_round}')
    except (FileNotFoundError, json.JSONDecodeError):
        with open(existing_path, 'w') as f:
            json.dump(all_matches, f)
        print(f'Saved! {target_round}')
