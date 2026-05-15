"""Run all data-fetch scripts in sequence to update local JSON files."""
import os
import subprocess
import sys

SCRIPTS_DIR = os.path.dirname(__file__)
ROOT = os.path.join(SCRIPTS_DIR, '..')
DATA_DIR = os.path.join(ROOT, 'data')


def run(script):
    print(f'\nRunning {script}...')
    subprocess.run(
        [sys.executable, os.path.join(SCRIPTS_DIR, script)],
        cwd=ROOT,
        check=True,
    )


run('get_cookie.py')
run('save_round.py')
run('save_draft.py')
run('get_player_scores.py')
run('save_scoreboard.py')
run('save_leaguetable.py')

print('\nDone. Live data saved. Run: python app.py')
