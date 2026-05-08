import json
import os
import threading
import time as time_module
from datetime import datetime, timezone, timedelta

from flask import Flask, render_template, request, jsonify, Response

import config

app = Flask(__name__, static_folder='public', static_url_path='')
app.secret_key = config.SECRET_KEY

DATA_DIR        = config.DATA_DIR
PLAYERFILES_DIR = config.PLAYERFILES_DIR

USERS = [
    {'usr': 'Funwolves',      'code': 'swerob'},
    {'usr': 'NSWasps',        'code': 'morboys'},
    {'usr': 'David Stocock',  'code': 'oboe'},
    {'usr': 'BumbleBlues',    'code': 'fumbleblues'},
    {'usr': 'DraftBaron',     'code': 'adont'},
    {'usr': 'Unbealevables',  'code': 'james123'},
    {'usr': 'ESTMD HMS',      'code': 'bonkin'},
    {'usr': 'Marika Stockad', 'code': 'bumty'},
    {'usr': 'Tuis doinshoey', 'code': 'odoylerules'},
    {'usr': 'Rees Hodge',     'code': 'bengowlah'},
    {'usr': 'all',            'code': 'HACKIN'},   # all user must be at end
]

SELECTION_TIME_MS = 92 * 1000

file_lock = threading.Lock()


# ── helpers ───────────────────────────────────────────────────────────────────

def read_json_file(path):
    with file_lock:
        with open(path, 'r') as f:
            return json.load(f)


def write_file(path, content):
    with file_lock:
        with open(path, 'w') as f:
            f.write(content)


def format_time(dt):
    return dt.strftime('%Y-%m-%dT%H:%M:%S.') + f'{dt.microsecond // 1000:03d}Z'


def parse_time(time_str):
    time_str = str(time_str).strip()
    try:
        if time_str.endswith('Z'):
            return datetime.fromisoformat(time_str[:-1]).replace(tzinfo=timezone.utc)
        return datetime.fromisoformat(time_str)
    except ValueError:
        try:
            return datetime.strptime(time_str[:23], '%Y-%m-%dT%H:%M:%S.%f').replace(tzinfo=timezone.utc)
        except ValueError:
            return datetime.now(timezone.utc)


def get_time_data():
    return read_json_file(PLAYERFILES_DIR / 'time.txt')


def set_time_data(obj):
    with file_lock:
        with open(PLAYERFILES_DIR / 'time.txt', 'w') as f:
            json.dump(obj, f)


def next_user(user, snake):
    user_id = -1
    for i, u in enumerate(USERS):
        if u['usr'] == user:
            user_id = i

    if user_id >= len(USERS) - 2:  # all user is at end
        if snake == 'up':
            snake = 'top'
        else:
            user_id -= 1
            snake = 'down'
    elif user_id == 0:
        if snake == 'down':
            snake = 'bottom'
        else:
            user_id += 1
            snake = 'up'
    elif snake == 'up':
        user_id += 1
    elif snake == 'down':
        user_id -= 1

    return {'u': user_id, 's': snake}


# ── background timer thread ───────────────────────────────────────────────────

def timer_background():
    while True:
        time_module.sleep(0.5)
        try:
            body = get_time_data()
            start = parse_time(body.get('time', ''))
            now = datetime.now(timezone.utc)
            elapsed_ms = (now - start).total_seconds() * 1000

            if elapsed_ms >= SELECTION_TIME_MS:
                nxt = next_user(body['usr'], body['snake'])
                new_obj = {
                    'time': format_time(datetime.now(timezone.utc)),
                    'usr': USERS[nxt['u']]['usr'],
                    'snake': nxt['s'],
                }
                set_time_data(new_obj)
        except Exception:
            pass


_timer_thread = threading.Thread(target=timer_background, daemon=True)
_timer_thread.start()


# ── page routes ───────────────────────────────────────────────────────────────

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/Draft')
def draft():
    return render_template('draft.html')


# ── data API routes ───────────────────────────────────────────────────────────

@app.route('/getcurrSeason')
def get_curr_season():
    data = read_json_file(DATA_DIR / 'currentseason.json')
    return jsonify(data)


@app.route('/getDraft', methods=['POST'])
def get_draft():
    round_no = request.form.get('round') or (request.get_json(silent=True) or {}).get('round')
    try:
        data = read_json_file(DATA_DIR / f'draft{round_no}.json')
        return jsonify(data)
    except Exception:
        return Response('', status=200)


@app.route('/getScoreboard/<round_no>')
def get_scoreboard(round_no):
    try:
        data = read_json_file(DATA_DIR / f'scoreboard{round_no}.json')
        return jsonify(data)
    except Exception:
        return Response('', status=200)


@app.route('/getPlayers/<round_no>')
def get_players(round_no):
    try:
        data = read_json_file(DATA_DIR / f'players{round_no}.json')
        return jsonify(data)
    except Exception:
        return Response('', status=200)


@app.route('/getRound')
def get_round():
    data = read_json_file(DATA_DIR / 'round.json')
    return jsonify(data)


# ── draft-day routes ──────────────────────────────────────────────────────────

@app.route('/getRemaining')
def get_remaining():
    data = read_json_file(PLAYERFILES_DIR / 'allplayers.txt')
    return jsonify(data)


@app.route('/setDraft', methods=['POST'])
def set_draft():
    players = request.form.get('players') or (request.get_json(silent=True) or {}).get('players')
    write_file(PLAYERFILES_DIR / 'allplayers.txt', players)
    return 'success'


@app.route('/getUsers')
def get_users():
    data = read_json_file(PLAYERFILES_DIR / 'users.txt')
    return jsonify(data)


@app.route('/setUsers', methods=['POST'])
def set_users():
    user_list = request.form.get('userList') or (request.get_json(silent=True) or {}).get('userList')
    write_file(PLAYERFILES_DIR / 'users.txt', user_list)
    return 'success'


@app.route('/getVisibleUser/<code>')
def get_visible_user(code):
    for user in USERS:
        if user['code'] == code:
            return user['usr']
    return 'unknown', 404


@app.route('/getTimer')
def get_timer():
    data = get_time_data()
    return jsonify(data)


@app.route('/startTimer/<to_change>')
def start_timer(to_change):
    if to_change == 'start':
        time_obj = {
            'time': format_time(datetime.now(timezone.utc)),
            'usr': USERS[0]['usr'],
            'snake': 'up',
        }
        set_time_data(time_obj)

    elif to_change == 'false':
        body = get_time_data()
        nxt = next_user(body['usr'], body['snake'])
        time_obj = {
            'time': format_time(datetime.now(timezone.utc)),
            'usr': USERS[nxt['u']]['usr'],
            'snake': nxt['s'],
        }
        set_time_data(time_obj)

    else:
        try:
            timeout_min = float(to_change)
            body = get_time_data()
            wait_till = parse_time(body['time']) + timedelta(minutes=timeout_min)
            time_obj = {
                'time': format_time(wait_till),
                'usr': body['usr'],
                'snake': body['snake'],
            }
            set_time_data(time_obj)
        except ValueError:
            pass

    return 'success'


# ── error handlers ────────────────────────────────────────────────────────────

@app.errorhandler(404)
def not_found(e):
    return render_template('error.html', message='Not Found', status=404), 404


@app.errorhandler(500)
def server_error(e):
    return render_template('error.html', message=str(e), status=500), 500


if __name__ == '__main__':
    app.run(host=config.HOST, port=config.PORT, debug=config.DEBUG)
