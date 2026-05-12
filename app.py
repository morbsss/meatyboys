import copy
import json
import os
import re
import threading
import time as time_module
from collections import defaultdict
from datetime import datetime, timezone, timedelta

from flask import Flask, render_template, request, jsonify, Response

import config

app = Flask(__name__, static_folder='public', static_url_path='')
app.secret_key = config.SECRET_KEY

DATA_DIR        = config.DATA_DIR
PLAYERFILES_DIR = config.PLAYERFILES_DIR

USERS = [
    {'usr': 'funwolves',        'code': 'swerob'},
    {'usr': 'Pizza Samu',       'code': 'morboys'},
    {'usr': 'Ned Shenanigans',  'code': 'oboe'},
    {'usr': 'BumbleBlues',      'code': 'fumbleblues'},
    {'usr': 'OnIslandTime',     'code': 'adont'},
    {'usr': 'Scrumchops',       'code': 'james123'},
    {'usr': 'The Chiefs',       'code': 'chieftan'},
    {'usr': 'Big KaTunas',      'code': 'bumty'},
    {'usr': 'BIG REDS',         'code': 'odoylerules'},
    {'usr': 'BumbIose',         'code': 'bengowlah'},
    {'usr': 'all',              'code': 'HACKIN'},   # all user must be at end
]

SELECTION_TIME_MS  = 92 * 1000
FINALS_START_ROUND = 14        # rounds 14+ are finals — league table freezes

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


@app.route('/leaguetable')
def leaguetable():
    return render_template('leaguetable.html')


@app.route('/finals')
def finals():
    return render_template('finals.html')


# ── data API routes ───────────────────────────────────────────────────────────

@app.route('/getLeagueTable')
def get_league_table():
    data = read_json_file(DATA_DIR / 'leaguetable.json')
    return jsonify(data)


@app.route('/getFinalsData')
def get_finals_data():
    all_teams = _live_ranked_teams()

    def round_team_scores(rnd):
        try:
            draft = read_json_file(DATA_DIR / f'draft{rnd}.json')
        except Exception:
            return None
        scores = defaultdict(float)
        for player in draft:
            uname = player.get('userName', '')
            if uname == 'Free Agent' or uname.startswith('WAIVERS'):
                continue
            if not player.get('bench'):
                try:
                    scores[uname] += float(player.get('score', 0) or 0)
                except (ValueError, TypeError):
                    pass
        return {k: round(v, 1) for k, v in scores.items()}

    def lookup(scores, name):
        if scores is None:
            return None
        if name in scores:
            return scores[name]
        n = _norm(name)
        for k, v in scores.items():
            if _norm(k) == n:
                return v
        return None

    r14 = round_team_scores(14)
    r15 = round_team_scores(15)
    r16 = round_team_scores(16)

    def get_team(rank):
        return next((t for t in all_teams if t['rank'] == rank), None)

    def build_semi(rank_a, rank_b):
        ta = get_team(rank_a)
        tb = get_team(rank_b)
        if not ta or not tb:
            return None
        na, nb = ta['team'], tb['team']
        r14a, r14b = lookup(r14, na), lookup(r14, nb)
        r15a, r15b = lookup(r15, na), lookup(r15, nb)
        has_data = any(x is not None for x in [r14a, r14b, r15a, r15b])
        agg_a = round((r14a or 0) + (r15a or 0), 1)
        agg_b = round((r14b or 0) + (r15b or 0), 1)
        return {
            'teamA': na, 'rankA': rank_a,
            'teamB': nb, 'rankB': rank_b,
            'round14': {'a': r14a, 'b': r14b},
            'round15': {'a': r15a, 'b': r15b},
            'aggregate': {'a': agg_a if has_data else None, 'b': agg_b if has_data else None},
            'hasData': has_data,
        }

    def champ_finalist(semi):
        if not semi or not semi['hasData']:
            return None
        agg = semi['aggregate']
        return semi['teamA'] if agg['a'] >= agg['b'] else semi['teamB']

    def sacko_finalist(semi):
        if not semi or not semi['hasData']:
            return None
        agg = semi['aggregate']
        return semi['teamA'] if agg['a'] <= agg['b'] else semi['teamB']

    cs1 = build_semi(1, 4)
    cs2 = build_semi(2, 3)
    ss1 = build_semi(7, 10)
    ss2 = build_semi(8, 9)

    cf_a, cf_b = champ_finalist(cs1), champ_finalist(cs2)
    sf_a, sf_b = sacko_finalist(ss1), sacko_finalist(ss2)

    def build_final(name_a, name_b):
        if not name_a or not name_b:
            return None
        return {
            'teamA': name_a, 'teamB': name_b,
            'round16': {'a': lookup(r16, name_a), 'b': lookup(r16, name_b)},
        }

    champ_final = build_final(cf_a, cf_b) if r15 is not None else None
    sacko_final = build_final(sf_a, sf_b) if r15 is not None else None

    try:
        current_round = read_json_file(DATA_DIR / 'round.json').get('round', 13)
    except Exception:
        current_round = 13

    is_live = False
    try:
        lw = read_json_file(DATA_DIR / 'fixtures.json').get('liveWindow', {})
        if lw.get('start') and lw.get('end'):
            win_start = datetime.fromisoformat(lw['start'].replace('Z', '+00:00'))
            win_end   = datetime.fromisoformat(lw['end'].replace('Z', '+00:00'))
            is_live   = win_start <= datetime.now(timezone.utc) <= win_end
    except Exception:
        pass

    try:
        last_fetch = read_json_file(DATA_DIR / 'lastfetch.json').get('time', '')
    except Exception:
        last_fetch = ''

    return jsonify({
        'currentRound': current_round,
        'champSemi1': cs1, 'champSemi2': cs2,
        'sackoSemi1': ss1, 'sackoSemi2': ss2,
        'champFinal': champ_final,
        'sackoFinal': sacko_final,
        'hasR14': r14 is not None,
        'hasR15': r15 is not None,
        'hasR16': r16 is not None,
        'live': is_live,
        'lastFetch': last_fetch,
        'lastUpdated': f'LIVE — Round {current_round}',
    })


def _norm(name):
    """Case-insensitive key that treats l/I as identical (common fantasy name trick)."""
    return re.sub(r'[^a-z0-9]', '', name.lower().replace('i', 'l'))


def _live_ranked_teams():
    """Flat list of all team dicts ranked 1-10, with live current-round scores applied."""
    base = read_json_file(DATA_DIR / 'leaguetable.json')
    result = copy.deepcopy(base)

    try:
        current_round = read_json_file(DATA_DIR / 'round.json').get('round', 1)
        draft_data = read_json_file(DATA_DIR / f'draft{current_round}.json')
    except Exception:
        draft_data = []

    try:
        matchups = read_json_file(DATA_DIR / 'fixtures.json').get('matchups', [])
    except Exception:
        matchups = []

    live_raw = defaultdict(float)
    for player in draft_data:
        uname = player.get('userName', '')
        if uname == 'Free Agent' or uname.startswith('WAIVERS'):
            continue
        if not player.get('bench'):
            try:
                live_raw[uname] += float(player.get('score', 0) or 0)
            except (ValueError, TypeError):
                pass

    live_by_lower = {n.lower(): v for n, v in live_raw.items()}
    live_by_norm  = {_norm(n): v for n, v in live_raw.items()}

    def _live(team_name):
        return live_by_lower.get(team_name.lower()) or live_by_norm.get(_norm(team_name)) or 0.0

    all_teams_map = {}
    for conf in result['conferences']:
        for team in conf['teams']:
            all_teams_map[_norm(team['team'])] = team

    for m in matchups:
        h, a = m.get('home', ''), m.get('away', '')
        hs, as_ = round(_live(h), 1), round(_live(a), 1)
        for name, my, opp in [(h, hs, as_), (a, as_, hs)]:
            t = all_teams_map.get(_norm(name))
            if t is None:
                continue
            t['pointsFor']     = round(t['pointsFor'] + my, 1)
            t['pointsAgainst'] = round(t['pointsAgainst'] + opp, 1)
            if my > opp:
                t['won'] += 1
            elif opp > my:
                t['lost'] += 1
            else:
                t['tied'] += 1

    for uname, score in live_raw.items():
        t = all_teams_map.get(_norm(uname))
        if t is not None and 'liveScore' not in t:
            t['pointsFor'] = round(t['pointsFor'] + score, 1)

    flat = [t for conf in result['conferences'] for t in conf['teams']]
    flat.sort(key=lambda t: (-t['won'], -t['pointsFor']))
    for i, t in enumerate(flat):
        t['rank'] = i + 1
    return flat


@app.route('/getLiveTable')
def get_live_table():
    base = read_json_file(DATA_DIR / 'leaguetable.json')

    try:
        round_data = read_json_file(DATA_DIR / 'round.json')
        current_round = round_data.get('round', 1)
    except Exception:
        base['live'] = False
        return jsonify(base)

    # Finals rounds: freeze the league table — no live scores, no TO GO, no THIS WEEK
    if current_round >= FINALS_START_ROUND:
        try:
            base['lastFetch'] = read_json_file(DATA_DIR / 'lastfetch.json').get('time', '')
        except Exception:
            base['lastFetch'] = ''
        base['live']        = False
        base['liveRound']   = current_round
        base['lastUpdated'] = ''
        return jsonify(base)

    try:
        draft_data = read_json_file(DATA_DIR / f'draft{current_round}.json')
    except Exception:
        base['live'] = False
        return jsonify(base)

    try:
        fixtures = read_json_file(DATA_DIR / 'fixtures.json')
        matchups = fixtures.get('matchups', [])
    except Exception:
        fixtures  = {}
        matchups  = []

    # Determine whether games are actively in play right now
    is_live = False
    lw = fixtures.get('liveWindow', {})
    if lw.get('start') and lw.get('end'):
        try:
            win_start = datetime.fromisoformat(lw['start'].replace('Z', '+00:00'))
            win_end   = datetime.fromisoformat(lw['end'].replace('Z', '+00:00'))
            is_live   = win_start <= datetime.now(timezone.utc) <= win_end
        except ValueError:
            pass

    # Sum live points per team (skip free agents / waiver picks)
    live_raw = defaultdict(float)
    to_play_raw = defaultdict(int)
    for player in draft_data:
        uname = player.get('userName', '')
        if uname == 'Free Agent' or uname.startswith('WAIVERS'):
            continue
        if not player.get('bench'):
            try:
                live_raw[uname] += float(player.get('score', 0) or 0)
            except (ValueError, TypeError):
                pass
        # Count active picks (not on fantasy bench) who haven't scored and aren't Out
        if (not player.get('bench')
                and player.get('teamNews') != 'Out'
                and float(player.get('score', 0) or 0) <= 0):
            to_play_raw[uname] += 1

    # Build normalised lookups so slightly different spellings still match
    live_by_lower    = {n.lower(): v for n, v in live_raw.items()}
    live_by_norm     = {_norm(n): v for n, v in live_raw.items()}
    to_play_by_lower = {n.lower(): v for n, v in to_play_raw.items()}
    to_play_by_norm  = {_norm(n): v for n, v in to_play_raw.items()}

    def players_to_play(team_name):
        return (to_play_by_lower.get(team_name.lower())
                or to_play_by_norm.get(_norm(team_name))
                or 0)

    def live_score(team_name):
        return (live_by_lower.get(team_name.lower())
                or live_by_norm.get(_norm(team_name))
                or 0.0)

    result = copy.deepcopy(base)

    # Index every team object by normalised name for fast lookup and assign toPlay
    all_teams = {}
    for conf in result['conferences']:
        for team in conf['teams']:
            all_teams[_norm(team['team'])] = team
            team['toPlay'] = players_to_play(team['team'])

    # Apply live fixture results
    for m in matchups:
        h_name, a_name = m.get('home', ''), m.get('away', '')
        h_score = round(live_score(h_name), 1)
        a_score = round(live_score(a_name), 1)

        for name, my_score, opp_score in [(h_name, h_score, a_score),
                                           (a_name, a_score, h_score)]:
            team = all_teams.get(_norm(name))
            if team is None:
                continue
            team['liveScore']        = my_score
            team['liveOpponentScore'] = opp_score
            team['pointsFor']        = round(team['pointsFor']        + my_score,  1)
            team['pointsAgainst']    = round(team['pointsAgainst']    + opp_score, 1)
            if my_score > opp_score:
                team['won']        += 1
                team['liveResult']  = 'W'
            elif opp_score > my_score:
                team['lost']       += 1
                team['liveResult']  = 'L'
            else:
                team['tied']       += 1
                team['liveResult']  = 'T'

    # Teams not in any fixture still accumulate live points for PF
    for uname, score in live_raw.items():
        team = all_teams.get(_norm(uname))
        if team is not None and 'liveScore' not in team:
            team['liveScore']  = round(score, 1)
            team['pointsFor']  = round(team['pointsFor'] + score, 1)

    # Assign global 1-10 ranks across both conferences
    all_teams_flat = [t for conf in result['conferences'] for t in conf['teams']]
    all_teams_flat.sort(key=lambda t: (-t['won'], -t['pointsFor']))
    for i, team in enumerate(all_teams_flat):
        team['rank'] = i + 1

    # Re-sort each conference by the global rank so they display in order
    for conf in result['conferences']:
        conf['teams'].sort(key=lambda t: t['rank'])

    try:
        last_fetch = read_json_file(DATA_DIR / 'lastfetch.json')
        result['lastFetch'] = last_fetch.get('time', '')
    except Exception:
        result['lastFetch'] = ''

    result['live']        = is_live
    result['liveRound']   = current_round
    result['lastUpdated'] = f'LIVE — Round {current_round}'
    return jsonify(result)


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
