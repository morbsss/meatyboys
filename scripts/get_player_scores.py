"""Fetch individual player scores for the current round and update the draft file."""
import json
import os

import requests

ROOT = os.path.join(os.path.dirname(__file__), '..')
DATA_DIR = os.path.join(ROOT, 'data')

LEAGUE_ID = 'fa3e96be-1307-4bd3-a2df-b3e40015a890'

with open(os.path.join(DATA_DIR, 'round.json')) as f:
    round_no = json.load(f)['round']

with open(os.path.join(DATA_DIR, 'cookie.txt')) as f:
    cookie = f.read().strip()

headers = {'Cookie': cookie}

draft_path = os.path.join(DATA_DIR, f'draftPlayers{round_no}.json')
with open(draft_path) as f:
    dps = json.load(f)


def get_player_score(player_id, rnd):
    payload = {
        'Data': json.dumps({
            'playerid': player_id,
            'leagueid': LEAGUE_ID,
            'action': 'member/common/playerstats',
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

    begin = content.find('</th>')
    move = content.find('<tbody>', begin)
    found = False
    fail = False
    counter = 0

    while not found:
        counter += 1
        next_tr = content.find('<tr>', move)
        if next_tr == -1:
            fail = True
            break
        move = next_tr + 1  # advance past this row for the next iteration
        slip = content.find('<td>', next_tr)
        move_end = content.find('</td>', next_tr)
        number_str = content[slip + 4:move_end].strip()
        try:
            if int(number_str) == rnd:
                found = True
        except ValueError:
            pass
        if counter > (rnd + 1):
            fail = True
            found = True

    if fail:
        return 0

    score_str_start = content.find('<td>', move_end)
    score_str_end = content.find('</td>', score_str_start)
    return content[score_str_start + 4:score_str_end].strip()


for i, player in enumerate(dps):
    print(i)
    if player.get('teamNews') in ('Starting', 'Bench') or player.get('position') == 'Front Row':
        dps[i]['score'] = get_player_score(player['playerId'], round_no)

out_path = os.path.join(DATA_DIR, f'draft{round_no}.json')
with open(out_path, 'w') as f:
    json.dump(dps, f)

print(f'Saved! {round_no}')
