$(function () {
    var playerid = $('body').data('playerid');

    $.getJSON('/getPlayerData/' + playerid, function (data) {
        var scores     = data.scores     || [];
        var pred       = data.prediction || null;
        var oppDelta   = data.opp_delta;
        var summary    = data.summary    || null;

        // ── header ──────────────────────────────────────────────────────────
        var name = (pred && pred.playername) || (summary && summary.playername) ||
                   (scores.length && scores[scores.length - 1].playername) || 'Unknown';
        var pos  = (pred && pred.position)   || (summary && summary.position)   || '';
        var team = (pred && pred.team)        || (summary && summary.team)        || '';
        var owner = (pred && pred.owner)      || (summary && summary.owner)       || '';

        $('#playerName').text(name);
        document.title = 'Meaty Boys Cup — ' + name;
        var meta = [pos, team, owner].filter(Boolean).join(' · ');
        $('#playerMeta').text(meta);

        // ── stat cards ───────────────────────────────────────────────────────
        var seasonAvg = summary ? round1(summary.total_mean) : null;
        var avg3g     = summary ? round1(summary.game3_avg)  : null;
        var avg5g     = summary ? round1(summary.game5_avg)  : null;
        var gbm       = pred    ? pred.gbm_pred              : null;
        var games     = summary ? summary.total_count        : null;

        var cards = [
            { label: 'Season Avg',  value: seasonAvg },
            { label: '3-Game Avg',  value: avg3g },
            { label: '5-Game Avg',  value: avg5g },
            { label: 'GBM Pred',    value: gbm },
            { label: 'Games',       value: games },
        ];

        var $cards = $('#statCards');
        cards.forEach(function (c) {
            var valHtml = (c.value !== null && c.value !== undefined)
                ? c.value
                : '<span class="na">—</span>';
            $cards.append(
                '<div class="stat-card">' +
                  '<div class="stat-label">' + c.label + '</div>' +
                  '<div class="stat-value">' + valHtml + '</div>' +
                '</div>'
            );
        });

        // ── round-by-round chart ─────────────────────────────────────────────
        if (scores.length) {
            var seasons = [...new Set(scores.map(function (s) { return s.season_year; }))].sort();
            var palette = ['#1a8fc4', '#e67e22', '#1a7a3c', '#8e44ad', '#c0392b'];

            var allRounds = [...new Set(scores.map(function (s) { return s.round_num; }))].sort(function (a, b) { return a - b; });

            var datasets = seasons.map(function (yr, i) {
                var color = palette[i % palette.length];
                var scoreMap = {};
                scores.filter(function (s) { return s.season_year === yr; })
                      .forEach(function (s) { scoreMap[s.round_num] = s.total; });
                return {
                    label: '' + yr,
                    data: allRounds.map(function (r) { return scoreMap[r] !== undefined ? scoreMap[r] : null; }),
                    borderColor: color,
                    backgroundColor: color + '33',
                    tension: 0.3,
                    fill: false,
                    pointRadius: 4,
                    pointHoverRadius: 6,
                    spanGaps: false,
                };
            });

            new Chart(document.getElementById('roundChart'), {
                type: 'line',
                data: { labels: allRounds, datasets: datasets },
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
                        y: { title: { display: true, text: 'Score' }, beginAtZero: true },
                    },
                },
            });
        }

        // ── score history table ──────────────────────────────────────────────
        var $sb = $('#scoreBody');
        if (scores.length) {
            var reversed = scores.slice().reverse();
            reversed.forEach(function (s) {
                $sb.append(
                    '<tr>' +
                    '<td>' + s.season_year + '</td>' +
                    '<td>' + s.round_num + '</td>' +
                    '<td>' + (s.team || '') + '</td>' +
                    '<td>' + (s.opposition || '') + '</td>' +
                    '<td><strong>' + (s.total !== null ? s.total : '—') + '</strong></td>' +
                    '</tr>'
                );
            });
        } else {
            $sb.append('<tr><td colspan="5" style="color:#aaa;text-align:center;">No score history</td></tr>');
        }

        // ── predictions table ────────────────────────────────────────────────
        var $pb = $('#predBody');
        if (pred) {
            $pb.append(
                '<tr>' +
                '<td class="td-gbm">' + fmt(pred.gbm_pred) + '</td>' +
                '<td>' + fmt(pred.baseline_3g_avg) + '</td>' +
                '<td>' + fmt(pred.baseline_season_avg) + '</td>' +
                '<td>' + fmt(pred.gamma_p30) + '</td>' +
                '<td>' + fmt(pred.gamma_p50) + '</td>' +
                '<td>' + fmt(pred.gamma_p70) + '</td>' +
                '<td>' + fmt(pred.weibull_p30) + '</td>' +
                '<td>' + fmt(pred.weibull_p50) + '</td>' +
                '<td>' + fmt(pred.weibull_p70) + '</td>' +
                '</tr>'
            );
        } else {
            $('#predSection').hide();
        }

        // ── opposition delta ─────────────────────────────────────────────────
        var $db = $('#deltaBody');
        if (pred && pred.opposition) {
            var deltaClass = '';
            var deltaStr = '—';
            if (oppDelta !== null && oppDelta !== undefined) {
                deltaClass = oppDelta >= 0 ? 'delta-pos' : 'delta-neg';
                deltaStr   = (oppDelta >= 0 ? '+' : '') + oppDelta;
            }
            $db.append(
                '<tr>' +
                '<td>' + pred.opposition + '</td>' +
                '<td>' + (pred.position || '') + '</td>' +
                '<td class="' + deltaClass + '">' + deltaStr + '</td>' +
                '</tr>'
            );
        } else {
            $('#deltaSection').hide();
        }

        $('#loader').hide();
        $('#content').show();
        $('[data-toggle="tooltip"]').tooltip({ placement: 'top' });

    }).fail(function () {
        $('#loader').hide();
        $('#content').show();
        $('#playerName').text('Error loading player data');
    });

    // ── helpers ──────────────────────────────────────────────────────────────
    function fmt(val) {
        if (val === null || val === undefined) return '<span class="td-na">—</span>';
        return val;
    }

    function round1(val) {
        if (val === null || val === undefined) return null;
        return Math.round(val * 10) / 10;
    }
});
