$(function () {
    var allPlayers      = [];
    var sortCol         = 'gbm_pred';
    var sortAsc         = false;
    var selectedMatchup = null; // { team_a, team_b }
    var isLive          = false;
    var loaded          = false;

    // ── load + poll ─────────────────────────────────────────────────────────
    function load() {
        $.when(
            $.getJSON('/getPredictions'),
            $.getJSON('/getWinPredictions'),
            $.getJSON('/getLiveWinPredictions')
        ).then(function (predRes, winRes, liveRes) {
            var predData = predRes[0];
            var winData  = winRes[0];
            var liveData = liveRes[0];

            allPlayers = predData.players || [];
            isLive     = !!predData.live;

            allPlayers.forEach(function (p) {
                p.display_score = (p.live_status === 'live' && p.live_score !== null && p.live_score !== undefined)
                    ? p.live_score
                    : (p.actual_score !== null && p.actual_score !== undefined ? p.actual_score : null);
            });

            var rnd = predData.round_num || winData.round_num;
            $('#roundNum').text(rnd || '—');

            // Live indicator: spinning cat + label (same format as the other live pages).
            // While live, hide the "Data last updated" line; show it only when not live.
            if (isLive) {
                $('#liveRoundLabel').text('LIVE — Round ' + (rnd || ''));
                $('#liveCatTop').css('display', 'flex');
                $('#lastUpdatedRow').hide();
            } else {
                $('#liveCatTop').hide();
                if (predData.last_updated) {
                    var d = new Date(predData.last_updated);
                    $('#lastUpdated').text(d.toLocaleString(undefined, {
                        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
                    }));
                }
                $('#lastUpdatedRow').show();
            }

            // Use live win probabilities when in the live window, else static
            var liveMatchups = liveData.matchups || [];
            var matchups = (isLive && liveMatchups.length) ? liveMatchups : (winData.matchups || []);
            buildWinCards(matchups);

            if (!loaded) {
                populateFilters(allPlayers);
                loaded = true;
                $('#loader').hide();
                $('#content').show();
                if (!allPlayers.length && !matchups.length) {
                    $('#roundNum').text('no data yet');
                }
            }

            renderTable();
            $('[data-toggle="tooltip"]').tooltip({ placement: 'top' });
        }).fail(function () {
            if (!loaded) {
                $('#loader').hide();
                $('#content').show();
                $('#roundNum').text('error loading data');
            }
        });
    }

    load();
    setInterval(load, 30000);  // same cadence as the live scoreboard pages

    // ── win prediction cards ───────────────────────────────────────────────
    function flagName(name) {
        return name;
    }

    function setMatchupFilter(m) {
        if (m && selectedMatchup && selectedMatchup.team_a === m.team_a && selectedMatchup.team_b === m.team_b) {
            selectedMatchup = null;
            sortCol = 'gbm_pred';
            sortAsc = false;
        } else {
            selectedMatchup = m;
            if (m) {
                sortCol = 'display_score';
                sortAsc = false;
            }
        }
        $('#predTable thead th').removeClass('sort-asc sort-desc');
        $('[data-col="' + sortCol + '"]').addClass('sort-desc');
        applyMatchupHighlight();
        renderTable();
    }

    function applyMatchupHighlight() {
        $('.matchup-card').removeClass('selected');
        if (selectedMatchup) {
            $('#matchupCard-' + selectedMatchup.team_a).addClass('selected');
            $('#matchupActive').show();
            $('#matchupActiveLabel').text(flagName(selectedMatchup.team_a) + ' vs ' + flagName(selectedMatchup.team_b));
        } else {
            $('#matchupActive').hide();
        }
    }

    function buildWinCards(matchups) {
        var $grid = $('#matchupGrid').empty();
        if (!matchups.length) {
            $('#winSection').hide();
            return;
        }
        $('#winSection').show();
        matchups.forEach(function (m) {
            var aProb = m.team_a_win_prob || 0;
            var bProb = m.team_b_win_prob || 0;
            var draw  = m.draw_prob || 0;
            var aFav  = aProb > bProb;

            function probClass(isFav) {
                var diff = Math.abs(aProb - bProb);
                if (diff < 5) return 'even';
                return isFav ? 'fav' : 'dog';
            }

            // Live locked score line (only present on live matchups)
            var hasLocked = (m.team_a_locked !== undefined && m.team_a_locked !== null);
            var liveLine  = (isLive && hasLocked)
                ? '<div class="m-live" style="text-align:center; font-size:11px; color:#d9534f; margin-top:2px;">' +
                      m.team_a_locked + ' &ndash; ' + m.team_b_locked + ' so far</div>'
                : '';

            var cardId = 'matchupCard-' + m.team_a;
            var $card = $(
                '<div class="matchup-card" id="' + cardId + '">' +
                  '<div class="matchup-teams">' +
                    '<div class="m-team">' +
                      '<div>' + flagName(m.team_a) + '</div>' +
                      '<div class="m-prob ' + probClass(aFav) + '">' + aProb + '%</div>' +
                    '</div>' +
                    '<div class="m-vs">vs</div>' +
                    '<div class="m-team right">' +
                      '<div>' + flagName(m.team_b) + '</div>' +
                      '<div class="m-prob ' + probClass(!aFav) + '">' + bProb + '%</div>' +
                    '</div>' +
                  '</div>' +
                  '<div class="prob-bar">' +
                    '<div class="prob-bar-fill" style="width:' + aProb + '%"></div>' +
                  '</div>' +
                  (draw > 0 ? '<div class="m-draw">draw ' + draw + '%</div>' : '') +
                  liveLine +
                '</div>'
            );
            $card.on('click', function () { setMatchupFilter(m); });
            $grid.append($card);
        });
        applyMatchupHighlight();
    }

    $('#matchupActive').on('click', function () { setMatchupFilter(null); });

    // ── filters ────────────────────────────────────────────────────────────
    function normaliseOwner(owner) {
        if (!owner) return '';
        return (owner === 'Free Agent' || owner.startsWith('WAIVERS')) ? 'Free Agent' : owner;
    }

    function populateFilters(players) {
        var positions = [...new Set(players.map(p => p.position).filter(Boolean))].sort();
        var owners    = [...new Set(players.map(p => normaliseOwner(p.owner)).filter(Boolean))].sort();

        positions.forEach(function (pos) {
            $('#posFilter').append('<option value="' + pos + '">' + pos + '</option>');
        });

        $('#ownerPanel').append('<div class="panel-clear-row"><a href="#" id="ownerClear">Clear</a></div>');

        owners.forEach(function (own) {
            var id = 'owner-' + own.replace(/\s+/g, '-');
            $('#ownerPanel').append(
                '<label><input type="checkbox" class="owner-cb" value="' + own + '" id="' + id + '"> ' + own + '</label>'
            );
        });
    }

    function selectedOwners() {
        var checked = [];
        $('.owner-cb:checked').each(function () { checked.push($(this).val()); });
        return checked;
    }

    function updateOwnerLabel() {
        var checked = selectedOwners();
        $('#ownerLabel').text(checked.length === 0 ? 'All Managers' : checked.length + ' selected');
    }

    function selectedNews() {
        var checked = [];
        $('.news-cb:checked').each(function () { checked.push($(this).val().toLowerCase()); });
        return checked;
    }

    function updateNewsLabel() {
        var checked = selectedNews();
        $('#newsLabel').text(checked.length === 0 ? 'All News' : checked.length + ' selected');
    }

    // Owner dropdown toggle
    $('#ownerBtn').on('click', function (e) {
        e.stopPropagation();
        $('#newsPanel').hide();
        $('#ownerPanel').toggle();
    });
    $(document).on('click', function () {
        $('#ownerPanel').hide();
        $('#newsPanel').hide();
    });
    $('#ownerPanel').on('click', function (e) { e.stopPropagation(); });
    $(document).on('change', '.owner-cb', function () { updateOwnerLabel(); renderTable(); });

    // News dropdown toggle
    $('#newsBtn').on('click', function (e) {
        e.stopPropagation();
        $('#ownerPanel').hide();
        $('#newsPanel').toggle();
    });
    $('#newsPanel').on('click', function (e) { e.stopPropagation(); });
    $(document).on('change', '.news-cb', function () { updateNewsLabel(); renderTable(); });

    // Clear buttons
    $(document).on('click', '#ownerClear', function (e) {
        e.preventDefault();
        e.stopPropagation();
        $('.owner-cb').prop('checked', false);
        updateOwnerLabel();
        renderTable();
    });
    $(document).on('click', '#newsClear', function (e) {
        e.preventDefault();
        e.stopPropagation();
        $('.news-cb').prop('checked', false);
        updateNewsLabel();
        renderTable();
    });

    $('#posFilter').on('change', renderTable);

    // ── table render ───────────────────────────────────────────────────────
    function filtered() {
        var pos    = $('#posFilter').val();
        var owners = selectedOwners();
        var news   = selectedNews();

        return allPlayers.filter(function (p) {
            if (selectedMatchup) {
                var o = (p.owner || '').toUpperCase();
                if (o !== selectedMatchup.team_a.toUpperCase() && o !== selectedMatchup.team_b.toUpperCase()) return false;
                if (p.lineup_role !== 'Starting') return false;
            } else if (owners.length) {
                if (!owners.includes(normaliseOwner(p.owner))) return false;
            }
            if (pos && p.position !== pos) return false;
            if (news.length) {
                var n = (p.news || '').toLowerCase();
                if (!news.includes(n)) return false;
            }
            return true;
        });
    }

    function sorted(players) {
        return players.slice().sort(function (a, b) {
            var av = a[sortCol], bv = b[sortCol];
            if (av === null || av === undefined) av = sortAsc ? Infinity : -Infinity;
            if (bv === null || bv === undefined) bv = sortAsc ? Infinity : -Infinity;
            if (typeof av === 'string') return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
            return sortAsc ? av - bv : bv - av;
        });
    }

    function fmt(val) {
        if (val === null || val === undefined) return '<span class="td-na">—</span>';
        return val;
    }

    function newsClass(news) {
        if (!news) return '';
        var n = news.toLowerCase();
        if (n === 'starting' || n === 'starting (c)') return 'td-starting';
        return 'td-bench';
    }

    function lineupClass(role) {
        if (!role) return '';
        return role === 'Starting' ? 'td-starting' : 'td-bench';
    }

    function renderTable() {
        var players = sorted(filtered());
        var $body   = $('#predBody').empty();

        players.forEach(function (p) {
            var nCls    = newsClass(p.news);
            var nameCell = p.playerid
                ? '<a href="/analysis/player/' + p.playerid + '" class="td-name">' + (p.playername || '') + '</a>'
                : '<span class="td-name">' + (p.playername || '') + '</span>';

            var lCls    = lineupClass(p.lineup_role);
            var liveScore   = (p.live_status === 'live' && p.live_score !== null && p.live_score !== undefined);
            var scoreVal    = liveScore ? p.live_score : (p.actual_score !== null && p.actual_score !== undefined ? p.actual_score : null);
            var scoreTd     = scoreVal !== null
                ? '<td class="td-actual"><strong>' + scoreVal + '</strong>' + (liveScore ? ' <span style="color:#e74c3c;font-size:9px;vertical-align:middle;">&#9679;</span>' : '') + '</td>'
                : '<td>' + fmt(null) + '</td>';

            // Live: bold/red once the player's match has been played (status 'live')
            var locked   = (p.live_status === 'live');
            var projTd   = '<td' + (locked ? ' class="td-actual"' : '') + '>' + fmt(p.projected_final) + '</td>';

            $body.append(
                '<tr>' +
                '<td class="td-name">' + nameCell + '</td>' +
                '<td>' + (p.position || '') + '</td>' +
                '<td class="col-narrow">' + (p.team || '') + '</td>' +
                '<td class="col-narrow">' + (p.opposition || '') + '</td>' +
                '<td>' + (p.owner || '') + '</td>' +
                '<td class="' + nCls + '">' + (p.news || '') + '</td>' +
                '<td class="' + lCls + '">' + (p.lineup_role || '') + '</td>' +
                scoreTd +
                projTd +
                '<td class="td-gbm">' + fmt(p.gbm_pred) + '</td>' +
                '<td>' + fmt(p.baseline_3g_avg) + '</td>' +
                '<td>' + fmt(p.baseline_season_avg) + '</td>' +
                '<td>' + fmt(p.gamma_p50) + '</td>' +
                '<td>' + fmt(p.weibull_p50) + '</td>' +
                '</tr>'
            );
        });

        $('#playerCount').text(players.length + ' players');
    }

    // ── column sort ────────────────────────────────────────────────────────
    $('#predTable thead th').on('click', function () {
        var col = $(this).data('col');
        if (sortCol === col) {
            sortAsc = !sortAsc;
        } else {
            sortCol = col;
            sortAsc = typeof allPlayers[0] !== 'undefined' &&
                      typeof allPlayers[0][col] === 'string';
        }
        $('#predTable thead th').removeClass('sort-asc sort-desc');
        $(this).addClass(sortAsc ? 'sort-asc' : 'sort-desc');
        renderTable();
    });

    // default sort indicator
    $('[data-col="gbm_pred"]').addClass('sort-desc');
});
