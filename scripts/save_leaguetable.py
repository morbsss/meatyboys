"""
Fetch league standings from fantasyrugbydraft.com and save to data/leaguetable.json.
"""
import json
import os
import re
from datetime import date

import requests

ROOT     = os.path.join(os.path.dirname(__file__), '..')
DATA_DIR = os.path.join(ROOT, 'data')

# Load credentials from .env (cron jobs don't inherit a shell environment)
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(ROOT, '.env'))
except ImportError:
    pass

LEAGUE_ID = os.environ["FRD_LEAGUE_ID"]
OUT_PATH  = os.path.join(DATA_DIR, 'leaguetable.json')

with open(os.path.join(DATA_DIR, 'cookie.txt')) as f:
    cookie = f.read().strip()

headers = {'Cookie': cookie}


def fetch_standings_html():
    payload = {
        'Data': json.dumps({
            'leagueid': LEAGUE_ID,
            'action': 'member/homepage/leaguetable',
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
    Parse the desktop table (class="data-tbl xs-sm-hidden") from the leaguetable
    control HTML.  Columns: (empty) | Rank | Team | Played | Won | Lost | Tied |
    Waiver | Points For | Points Against | Trophies
    """
    if not html or 'Conference' not in html:
        return None

    tbl_start = html.find('class="data-tbl')
    if tbl_start == -1:
        return None

    conferences = []
    current_conf = None
    current_teams = []
    pos = tbl_start

    while pos < len(html):
        thead_pos = html.find('<thead>', pos)
        tbody_pos = html.find('<tbody>', pos)

        if thead_pos == -1 and tbody_pos == -1:
            break

        if thead_pos != -1 and (tbody_pos == -1 or thead_pos < tbody_pos):
            thead_end = html.find('</thead>', thead_pos)
            block = html[thead_pos:thead_end]
            m = re.search(r'<th id="thConference">([^<]+)</th>', block)
            if m:
                if current_conf and current_teams:
                    conferences.append({'name': current_conf, 'teams': current_teams})
                current_conf = m.group(1).strip()
                current_teams = []
            pos = thead_end + 8
        else:
            tbody_end = html.find('</tbody>', tbody_pos)
            block = html[tbody_pos:tbody_end]
            rows = re.findall(r'<tr>(.*?)</tr>', block, re.DOTALL)
            for row in rows:
                cells = re.findall(r'<td[^>]*>(.*?)</td>', row, re.DOTALL)
                cells = [re.sub(r'<[^>]+>', '', c).strip() for c in cells]
                # cells: [conf(empty), rank, team, played, won, lost, tied, waiver, PF, PA, trophies]
                if len(cells) >= 11:
                    try:
                        current_teams.append({
                            'rank':          int(cells[1]),
                            'team':          cells[2],
                            'played':        int(cells[3]),
                            'won':           int(cells[4]),
                            'lost':          int(cells[5]),
                            'tied':          int(cells[6]),
                            'waiver':        int(cells[7]),
                            'pointsFor':     float(cells[8]),
                            'pointsAgainst': float(cells[9]),
                            'trophies':      int(cells[10]),
                        })
                    except (ValueError, IndexError):
                        continue
            pos = tbody_end + 8

    if current_conf and current_teams:
        conferences.append({'name': current_conf, 'teams': current_teams})

    return conferences if conferences else None


def main():
    print('Fetching standings from fantasyrugbydraft.com...')
    html = fetch_standings_html()
    conferences = parse_standings(html)
    if not conferences:
        print('Could not parse standings - leaving existing leaguetable.json unchanged.')
        return

    result = {
        'lastUpdated': str(date.today()),
        'conferences': conferences,
    }
    with open(OUT_PATH, 'w') as f:
        json.dump(result, f, indent=2)
    total = sum(len(c['teams']) for c in conferences)
    print(f'Saved! {total} teams across {len(conferences)} conferences.')


if __name__ == '__main__':
    main()
