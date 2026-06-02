$(function () {
    // Dropdown options: Team of the Year (whole season), then rounds 1-13 and finals.
    var ROUND_OPTIONS = [{ value: 'year', label: 'Team of the Year' }];
    for (var r = 1; r <= 13; r++) {
        ROUND_OPTIONS.push({ value: String(r), label: 'Round ' + r });
    }
    ROUND_OPTIONS.push({ value: '14', label: 'Semi Final 1' });
    ROUND_OPTIONS.push({ value: '15', label: 'Semi Final 2' });
    ROUND_OPTIONS.push({ value: '16', label: 'Final' });

    // Display label per position line.
    var POS_LABELS = {
        'Outside Back':  'Outside Backs',
        'Midfielder':    'Midfield',
        'Fly Half':      'Fly Half',
        'Half Back':     'Half Back',
        'Loose Forward': 'Loose Forwards',
        'Lock':          'Lock',
        'Front Row':     'Front Row'
    };

    function buildSelect() {
        var $sel = $('#roundSelect');
        ROUND_OPTIONS.forEach(function (o) {
            $sel.append($('<option>').val(o.value).text(o.label));
        });
        $sel.on('change', function () { load($(this).val()); });
    }

    function esc(s) {
        return $('<div>').text(s == null ? '' : s).html();
    }

    function playerCard(p) {
        if (!p) {
            return '<div class="totw-card empty"><div class="totw-empty-text">&mdash;</div></div>';
        }
        var meta = esc(p.team || '');
        if (p.opposition) {
            meta += ' <span style="color:#aaa;">vs ' + esc(p.opposition) + '</span>';
        } else if (p.games) {
            meta += ' <span style="color:#aaa;">&middot; ' + p.games + ' games</span>';
        }
        return '' +
            '<div class="totw-card">' +
                '<div class="totw-score">' + (p.total != null ? p.total : '0') + '</div>' +
                '<div class="totw-name">' + esc(p.playername) + '</div>' +
                '<div class="totw-meta">' + meta + '</div>' +
                '<div class="totw-owner">' + esc(p.owner || '') + '</div>' +
            '</div>';
    }

    function render(data) {
        var $pitch = $('#pitch').empty();
        var $total = $('#totwTotal').empty();

        $('#pageHeading').text(data && data.label ? data.label : 'Team of the Week');

        if (!data || !data.hasData) {
            $pitch.hide();
            $total.hide();
            $('#noData').show();
            return;
        }
        $('#noData').hide();
        $pitch.show();

        var sum = 0, count = 0;
        (data.team || []).forEach(function (line) {
            var label = POS_LABELS[line.position] || line.position;
            var cards = line.players.map(function (p) {
                if (p && p.total != null) { sum += p.total; count++; }
                return playerCard(p);
            }).join('');
            $pitch.append(
                '<div>' +
                    '<div class="line-label">' + esc(label) + '</div>' +
                    '<div class="pitch-line">' + cards + '</div>' +
                '</div>'
            );
        });

        $total.html('Total &mdash; <strong>' + Math.round(sum * 10) / 10 + '</strong> pts from ' + count + ' players').show();
    }

    function load(selection) {
        $('#loader').show();
        $('#content').hide();
        var url = (selection === 'year')
            ? '/getTeamOfTheYear'
            : '/getTeamOfTheWeek/' + selection;
        $.getJSON(url)
            .done(function (data) {
                render(data);
            })
            .fail(function () {
                $('#pitch').empty();
                $('#totwTotal').empty();
                $('#noData').text('Error loading data.').show();
            })
            .always(function () {
                $('#loader').hide();
                $('#content').show();
            });
    }

    buildSelect();
    load($('#roundSelect').val());
});
