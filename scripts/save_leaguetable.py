"""
Fetch league standings from fantasyrugbydraft.com and save to data/leaguetable.json.

The script tries the ASMX API endpoint first. If the response HTML doesn't
contain recognisable standings data it leaves the existing JSON unchanged so
the page keeps showing the last good data.
"""
import json
import os
import re
from datetime import date

import requests

ROOT     = os.path.join(os.path.dirname(__file__), '..')
DATA_DIR = os.path.join(ROOT, 'data')

LEAGUE_ID = 'fa3e96be-1307-4bd3-a2df-b3e40015a890'
OUT_PATH  = os.path.join(DATA_DIR, 'leaguetable.json')

with open(os.path.join(DATA_DIR, 'cookie.txt')) as f:
    cookie = f.read().strip()

headers = {'Cookie': cookie}


def fetch_standings_html():
    """Try the ASMX control endpoint for league standings."""
    payload = {
        'Data': json.dumps({
            'leagueid': LEAGUE_ID,
            'action': 'member/league/standings',
            'type': 'control',
        })
    }
    resp = requests.post(
        'http://www.fantasyrugbydraft.com/Web/Services/Action.asmx/Request',
        json=payload,
        headers=headers,
        timeout=15,
    )
    try:
        return json.loads(resp.json()['d'])['Content']
    except Exception:
        return None


def parse_standings(html):
    """
    Parse the standings HTML returned by the API.

    The page typically has two conference tables. Each table has a header row
    with the conference name followed by team rows.  Returns a list of
    conference dicts, or None if parsing fails.
    """
    if not html or 'Conference' not in html:
        return None

    conferences = []

    # Split on conference header sections
    conf_blocks = re.split(r'(?=Conference\s+\d)', html)

    for block in conf_blocks:
        conf_name_match = re.search(r'(Conference\s+\d)', block)
        if not conf_name_match:
            continue
        conf_name = conf_name_match.group(1)

        teams = []
        # Each row typically looks like:
        #   <tr ...><td>rank</td><td>teamname</td><td>P</td><td>W</td>...
        rows = re.findall(r'<tr[^>]*>(.*?)</tr>', block, re.DOTALL)
        for row in rows:
            cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
            # Strip HTML tags from each cell
            cells = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
            if len(cells) >= 10:
                try:
                    teams.append({
                        'rank':          int(cells[0]),
                        'team':          cells[1],
                        'played':        int(cells[2]),
                        'won':           int(cells[3]),
                        'lost':          int(cells[4]),
                        'tied':          int(cells[5]),
                        'waiver':        int(cells[6]),
                        'pointsFor':     float(cells[7]),
                        'pointsAgainst': float(cells[8]),
                        'trophies':      int(cells[9]) if len(cells) > 9 else 0,
                    })
                except (ValueError, IndexError):
                    continue

        if teams:
            conferences.append({'name': conf_name, 'teams': teams})

    return conferences if conferences else None


def main():
    print('Fetching standings from fantasyrugbydraft.com...')
    html = fetch_standings_html()

    conferences = parse_standings(html)
    if not conferences:
        print('Could not parse standings — leaving existing leaguetable.json unchanged.')
        return

    result = {
        'lastUpdated': str(date.today()),
        'conferences': conferences,
    }
    with open(OUT_PATH, 'w') as f:
        json.dump(result, f, indent=2)
    print(f'Saved! {sum(len(c["teams"]) for c in conferences)} teams across {len(conferences)} conferences.')


if __name__ == '__main__':
    main()
