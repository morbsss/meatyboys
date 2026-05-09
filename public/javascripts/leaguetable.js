$(document).ready(function () {
    loadTable();
    setInterval(loadTable, 30 * 1000);
});

function loadTable() {
    $.get('/getLiveTable', function (data) {
        renderTable(data);
    });
}

function renderTable(data) {
    var COLS = ['RANK', 'TEAM', 'PLAYED', 'WON', 'LOST', 'TIED',
                'WAIVER', 'PTS FOR', 'PTS AGAINST', 'THIS WEEK', 'TO GO', 'TROPHIES'];

    var rows = '';
    for (var c = 0; c < data.conferences.length; c++) {
        var conf = data.conferences[c];

        rows += '<tr class="confHeader"><th></th>';
        for (var h = 0; h < COLS.length; h++) {
            rows += '<th>' + COLS[h] + '</th>';
        }
        rows += '</tr>';

        for (var t = 0; t < conf.teams.length; t++) {
            var team = conf.teams[t];

            var trophy = team.trophies > 0
                ? '<i class="fas fa-trophy"></i> ' + team.trophies
                : '0';

            rows += '<tr class="teamRow">' +
                '<td></td>' +
                '<td>' + team.rank + '</td>' +
                '<td>' + team.team + '</td>' +
                '<td>' + team.played + '</td>' +
                '<td>' + team.won + '</td>' +
                '<td>' + team.lost + '</td>' +
                '<td>' + team.tied + '</td>' +
                '<td class="waiver">' + team.waiver + '</td>' +
                '<td>' + team.pointsFor + '</td>' +
                '<td>' + team.pointsAgainst + '</td>' +
                '<td>' + buildThisWeek(team) + '</td>' +
                '<td>' + (team.toPlay !== undefined ? team.toPlay : '—') + '</td>' +
                '<td class="trophyCell">' + trophy + '</td>' +
                '</tr>';
        }
    }

    document.getElementById('ltTable').innerHTML = rows;

    if (data.live) {
        document.getElementById('liveCatImg').style.display = '';
        document.getElementById('liveRoundLabel').textContent = data.lastUpdated || '';
        document.getElementById('liveRoundLabel').style.display = '';
        document.getElementById('lastUpdatedLabel').style.display = 'none';
        document.getElementById('liveCatTop').style.display = 'flex';
    } else {
        document.getElementById('liveCatImg').style.display = 'none';
        document.getElementById('liveRoundLabel').style.display = 'none';
        if (data.lastFetch) {
            var d = new Date(data.lastFetch);
            var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
            var label = '* last updated ' + d.getDate() + ' ' + months[d.getMonth()] + ' ' +
                        ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2);
            document.getElementById('lastUpdatedLabel').textContent = label;
            document.getElementById('lastUpdatedLabel').style.display = '';
            document.getElementById('liveCatTop').style.display = 'flex';
        } else {
            document.getElementById('liveCatTop').style.display = 'none';
        }
    }

    // reveal table, hide loader (same pattern as main.js)
    document.getElementById('loader').style.display = 'none';
    document.getElementById('ltWrap').style.display = 'block';
}

function buildThisWeek(team) {
    if (typeof team.liveScore === 'undefined') {
        return '<span class="noFixture">—</span>';
    }
    var myScore  = team.liveScore.toFixed(1);
    var oppScore = (team.liveOpponentScore || 0).toFixed(1);
    var cls = team.liveResult === 'W' ? 'liveWin'
            : team.liveResult === 'L' ? 'liveLoss'
            : 'liveTie';
    return '<span class="' + cls + '">' + myScore + '</span>' +
           '<span class="liveVs">v</span>' +
           '<span>' + oppScore + '</span>';
}
