$(function () {
    var allPlayers = [];
    var selected   = [];          // ordered list of playerids (max 4)
    var cache      = {};          // playerid -> getPlayerData response
    var chart      = null;
    var chartMode  = 'round';     // 'round' or 'cumulative'

    var COLORS = ['#1a8fc4', '#e67e22', '#1a7a3c', '#8e44ad'];

    // ── load player list ───────────────────────────────────────────────────
    $.getJSON('/getPlayerList', function (data) {
        allPlayers = data.players || [];
        renderList(allPlayers);
        $('#loader').hide();
        $('#content').show();
    }).fail(function () {
        $('#loader').hide();
        $('#content').show();
        $('#playerList').html('<div class="player-list-empty">Error loading players</div>');
    });

    // ── chart mode toggle ──────────────────────────────────────────────────
    $('#toggleRound').on('click', function () {
        if (chartMode === 'round') return;
        chartMode = 'round';
        $('#toggleRound').addClass('active');
        $('#toggleCumulative').removeClass('active');
        updateChart();
    });
    $('#toggleCumulative').on('click', function () {
        if (chartMode === 'cumulative') return;
        chartMode = 'cumulative';
        $('#toggleCumulative').addClass('active');
        $('#toggleRound').removeClass('active');
        updateChart();
    });

    // ── search ─────────────────────────────────────────────────────────────
    $('#playerSearch').on('input', function () {
        var q = $(this).val().toLowerCase().trim();
        var filtered = q
            ? allPlayers.filter(function (p) {
                return (p.playername || '').toLowerCase().indexOf(q) !== -1;
              })
            : allPlayers;
        renderList(filtered);
    });

    // ── player list render ─────────────────────────────────────────────────
    function renderList(players) {
        var $list = $('#playerList').empty();

        if (!players.length) {
            $list.html('<div class="player-list-empty">No players found</div>');
            return;
        }

        var shown = players.slice(0, 80);
        shown.forEach(function (p) {
            var isAdded = selected.indexOf(p.playerid) !== -1;
            var meta = [p.position, p.team].filter(Boolean).join(' · ');
            if (p.season_avg != null) meta += ' · ' + p.season_avg + ' avg';

            $('<div class="player-item' + (isAdded ? ' added' : '') + '">' +
                '<div class="pi-name">' + esc(p.playername) + '</div>' +
                '<div class="pi-meta">' + esc(meta) + '</div>' +
              '</div>')
              .data('playerid', p.playerid)
              .appendTo($list);
        });

        if (players.length > 80) {
            $list.append(
                '<div class="pi-more">Showing 80 of ' + players.length + ' — type to narrow search</div>'
            );
        }
    }

    // ── add / remove players ───────────────────────────────────────────────
    $(document).on('click', '.player-item:not(.added)', function () {
        if (selected.length >= 4) return;
        var pid = $(this).data('playerid');
        if (selected.indexOf(pid) !== -1) return;
        selected.push(pid);
        renderSelected();
        refreshListHighlight();

        if (cache[pid]) {
            updateChart();
            updateStats();
        } else {
            $.getJSON('/getPlayerData/' + pid, function (data) {
                cache[pid] = data;
                updateChart();
                updateStats();
            });
        }
    });

    $(document).on('click', '.chip-remove', function (e) {
        e.stopPropagation();
        var pid = $(this).data('pid');
        selected = selected.filter(function (id) { return id !== pid; });
        renderSelected();
        refreshListHighlight();
        updateChart();
        updateStats();
    });

    function refreshListHighlight() {
        $('#playerList .player-item').each(function () {
            var pid = $(this).data('playerid');
            $(this).toggleClass('added', selected.indexOf(pid) !== -1);
        });
    }

    // ── selected chips ─────────────────────────────────────────────────────
    function renderSelected() {
        var $strip = $('#selectedStrip').empty();
        $('#selCount').text('(' + selected.length + ' / 4)');

        if (selected.length === 0) {
            $strip.append('<span class="no-selection">Select up to 4 players from the list on the left</span>');
            return;
        }

        selected.forEach(function (pid, i) {
            var color = COLORS[i];
            var name  = playerName(pid);
            $strip.append(
                '<div class="sel-chip" style="border-color:' + color + ';color:' + color + '">' +
                  '<span class="chip-dot" style="background:' + color + '"></span>' +
                  esc(name) +
                  '<button class="chip-remove" data-pid="' + pid + '">&#215;</button>' +
                '</div>'
            );
        });

        if (selected.length < 4) {
            $strip.append('<span class="add-hint">+ ' + (4 - selected.length) + ' more</span>');
        }
    }

    // ── chart ──────────────────────────────────────────────────────────────
    function updateChart() {
        if (chart) { chart.destroy(); chart = null; }

        var ready = selected.filter(function (pid) { return !!cache[pid]; });

        if (!ready.length) {
            $('#compareChart').hide();
            $('#chartEmpty').show();
            $('#chartToggleBar').hide();
            $('#chartSeasonLabel').text('select players to begin');
            return;
        }

        // Use the max season present across all loaded players
        var maxSeason = 0;
        ready.forEach(function (pid) {
            (cache[pid].scores || []).forEach(function (s) {
                if (s.season_year > maxSeason) maxSeason = s.season_year;
            });
        });

        // Union of all rounds in that season
        var roundSet = {};
        ready.forEach(function (pid) {
            (cache[pid].scores || [])
                .filter(function (s) { return s.season_year === maxSeason; })
                .forEach(function (s) { roundSet[s.round_num] = true; });
        });
        var rounds = Object.keys(roundSet).map(Number).sort(function (a, b) { return a - b; });

        var isCumulative = (chartMode === 'cumulative');

        var datasets = ready.map(function (pid) {
            var color    = COLORS[selected.indexOf(pid)];
            var scoreMap = {};
            (cache[pid].scores || [])
                .filter(function (s) { return s.season_year === maxSeason; })
                .forEach(function (s) { scoreMap[s.round_num] = s.total; });

            return {
                label:            playerName(pid),
                data:             buildData(rounds, scoreMap, isCumulative),
                borderColor:      color,
                backgroundColor:  color + '33',
                tension:          0.3,
                fill:             false,
                pointRadius:      4,
                pointHoverRadius: 6,
                spanGaps:         isCumulative,
            };
        });

        $('#chartSeasonLabel').text(maxSeason + ' season');
        $('#chartEmpty').hide();
        $('#compareChart').show();
        $('#chartToggleBar').show();

        chart = new Chart(document.getElementById('compareChart'), {
            type: 'line',
            data: { labels: rounds, datasets: datasets },
            options: {
                responsive: true,
                plugins: {
                    legend: { position: 'top' },
                    tooltip: {
                        callbacks: {
                            title: function (items) { return 'Round ' + items[0].label; },
                        },
                    },
                },
                scales: {
                    x: { title: { display: true, text: 'Round' } },
                    y: { title: { display: true, text: isCumulative ? 'Total Score' : 'Score' }, beginAtZero: true },
                },
            },
        });
    }

    // ── stats table ────────────────────────────────────────────────────────
    var STATS = [
        { label: 'Position',    get: function (d) { return str(d.summary, 'position'); } },
        { label: 'Team',        get: function (d) { return str(d.summary, 'team'); } },
        { label: 'Owner',       get: function (d) { return str(d.summary, 'owner'); } },
        { label: 'Season Avg',  get: function (d) { return num(d.summary, 'total_mean'); },  numeric: true, best: 'high' },
        { label: '3-Game Avg',  get: function (d) { return num(d.summary, 'game3_avg'); },   numeric: true, best: 'high' },
        { label: '5-Game Avg',  get: function (d) { return num(d.summary, 'game5_avg'); },   numeric: true, best: 'high' },
        { label: 'GBM Pred',    get: function (d) { return num(d.prediction, 'gbm_pred'); }, numeric: true, best: 'high' },
        { label: 'Games',       get: function (d) { return num(d.summary, 'total_count'); }, numeric: true },
    ];

    function updateStats() {
        var ready = selected.filter(function (pid) { return !!cache[pid]; });

        if (!ready.length) {
            $('#statsSection').hide();
            return;
        }
        $('#statsSection').show();

        // Header
        var headHtml = '<tr><th class="stat-label-col">Stat</th>';
        ready.forEach(function (pid, i) {
            var color = COLORS[selected.indexOf(pid)];
            headHtml += '<th class="player-col" style="color:' + color + '">' + esc(playerName(pid)) + '</th>';
        });
        headHtml += '</tr>';
        $('#statsHead').html(headHtml);

        // Rows
        var bodyHtml = '';
        STATS.forEach(function (def) {
            var vals = ready.map(function (pid) { return def.get(cache[pid]); });

            // Find best among numeric stats with a best direction
            var best = null;
            if (def.numeric && def.best === 'high' && vals.filter(function (v) { return v !== null; }).length > 1) {
                best = Math.max.apply(null, vals.filter(function (v) { return v !== null; }));
            }

            bodyHtml += '<tr><td class="stat-label-col">' + def.label + '</td>';
            vals.forEach(function (v) {
                var display = v !== null ? v : '<span class="td-na">—</span>';
                var cls     = (best !== null && v === best) ? ' class="td-best"' : '';
                bodyHtml += '<td' + cls + '>' + display + '</td>';
            });
            bodyHtml += '</tr>';
        });
        $('#statsBody').html(bodyHtml);
    }

    // ── helpers ────────────────────────────────────────────────────────────
    function playerName(pid) {
        if (cache[pid]) {
            var d = cache[pid];
            if (d.prediction && d.prediction.playername) return d.prediction.playername;
            if (d.summary    && d.summary.playername)    return d.summary.playername;
        }
        var p = allPlayers.filter(function (x) { return x.playerid === pid; })[0];
        return p ? p.playername : pid;
    }

    function buildData(rounds, scoreMap, cumulative) {
        if (!cumulative) {
            return rounds.map(function (r) {
                return scoreMap[r] !== undefined ? scoreMap[r] : null;
            });
        }
        var running = 0;
        var started = false;
        return rounds.map(function (r) {
            if (scoreMap[r] !== undefined) {
                running += scoreMap[r];
                started  = true;
            }
            return started ? Math.round(running * 10) / 10 : null;
        });
    }

    function num(obj, field) {
        if (!obj || obj[field] === null || obj[field] === undefined) return null;
        var v = obj[field];
        return typeof v === 'number' ? Math.round(v * 10) / 10 : v;
    }

    function str(obj, field) {
        if (!obj || !obj[field]) return null;
        return obj[field];
    }

    function esc(s) {
        if (!s) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }
});
