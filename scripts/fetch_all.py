"""Fetch data for all rounds (1-13) and restore the current round."""
import json
import os
import subprocess
import sys

SCRIPTS_DIR = os.path.dirname(__file__)
ROOT = os.path.join(SCRIPTS_DIR, '..')
DATA_DIR = os.path.join(ROOT, 'data')
ROUND_FILE = os.path.join(DATA_DIR, 'round.json')

FROM = 1
TO = 13
CURRENT = 13


def run(script):
    subprocess.run([sys.executable, os.path.join(SCRIPTS_DIR, script)], cwd=ROOT, check=True)


def set_round(n):
    with open(ROUND_FILE, 'w') as f:
        json.dump({'round': n, 'official': n}, f)


def step(label, fn):
    try:
        fn()
    except Exception as e:
        print(f'  FAILED {label}: {e}')


print('Refreshing cookie...')
run('get_cookie.py')

for round_no in range(FROM, TO + 1):
    print(f'\n=== Round {round_no} / {TO} ===')
    set_round(round_no)
    step('save_draft',        lambda: run('save_draft.py'))
    step('get_player_scores', lambda: run('get_player_scores.py'))
    step('save_scoreboard',   lambda: run('save_scoreboard.py'))

print(f'\nRestoring round.json → {CURRENT}')
set_round(CURRENT)
print(f'Done. Rounds {FROM}-{TO} fetched.')
