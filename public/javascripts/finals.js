$(document).ready(function () {
    loadFinals();
    setInterval(loadFinals, 30 * 1000);
});

function loadFinals() {
    $.get('/getFinalsData', function (data) {
        renderFinals(data);
    });
}

function fmt(v) {
    return (v !== null && v !== undefined) ? parseFloat(v).toFixed(1) : '&mdash;';
}

function renderFinals(data) {
    document.getElementById('champSection').innerHTML = buildSection(data, false);
    document.getElementById('sackoSection').innerHTML = buildSection(data, true);

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

    document.getElementById('loader').style.display = 'none';
    document.getElementById('finalsWrap').style.display = 'block';
}

function buildSection(data, isSacko) {
    var s1     = isSacko ? data.sackoSemi1  : data.champSemi1;
    var s2     = isSacko ? data.sackoSemi2  : data.champSemi2;
    var final_ = isSacko ? data.sackoFinal  : data.champFinal;
    var cls    = isSacko ? 'sacko' : 'champ';

    // Determine finalists (for bracket display)
    var f1 = finalist(s1, isSacko);
    var f2 = finalist(s2, isSacko);
    var hasFinalists = f1 !== null && f2 !== null;

    // Team bars for each semi
    var s1A = teamBar(s1 ? s1.teamA : null, s1 ? s1.rankA : null, s1 ? s1.aggregate.a : null, s1 ? isHighlighted(s1, 'A', isSacko) : false, cls);
    var s1B = teamBar(s1 ? s1.teamB : null, s1 ? s1.rankB : null, s1 ? s1.aggregate.b : null, s1 ? isHighlighted(s1, 'B', isSacko) : false, cls);
    var s2A = teamBar(s2 ? s2.teamA : null, s2 ? s2.rankA : null, s2 ? s2.aggregate.a : null, s2 ? isHighlighted(s2, 'A', isSacko) : false, cls);
    var s2B = teamBar(s2 ? s2.teamB : null, s2 ? s2.rankB : null, s2 ? s2.aggregate.b : null, s2 ? isHighlighted(s2, 'B', isSacko) : false, cls);

    // Finalist bars for center final box
    var fBar1 = finalBar(f1, final_ ? final_.round16.a : null, cls, final_ ? isFinalWinner(final_, 'A', isSacko) : false, isSacko);
    var fBar2 = finalBar(f2, final_ ? final_.round16.b : null, cls, final_ ? isFinalWinner(final_, 'B', isSacko) : false, isSacko);

    var trophyIcon = isSacko ? '&#127814;' : '&#127942;';
    var titleText  = isSacko ? '&#127814; Sacko' : '&#127942; Championship';
    var finalLabel = isSacko ? 'SACKO<br>FINAL' : 'CHAMPIONSHIP<br>FINAL';

    var html = '<div class="sec-title ' + cls + '">' + titleText + '</div>';
    html += '<div class="bracket-wrap">';

    // CSS grid: 5 columns × 4 rows
    html += '<div class="bgrid">';

    // Row 1: labels
    html += '<div class="lbl semi-lbl">SEMI-FINAL</div>';
    html += '<div></div>';
    html += '<div class="lbl final-lbl">' + trophyIcon + '<br>' + finalLabel + '</div>';
    html += '<div></div>';
    html += '<div class="lbl semi-lbl">SEMI-FINAL</div>';

    // Row 2: team A | arm-upper | finalist 1 | arm-upper | team A
    html += s1A;
    html += '<div class="arm aul"></div>';
    html += fBar1;
    html += '<div class="arm aur"></div>';
    html += s2A;

    // Row 3: middle connector — bracket midpoints join and point to the finals
    html += '<div></div>';
    html += '<div class="arm aml"></div>';
    html += '<div></div>';
    html += '<div class="arm amr"></div>';
    html += '<div></div>';

    // Row 4: team B | arm-lower | finalist 2 | arm-lower | team B
    html += s1B;
    html += '<div class="arm all"></div>';
    html += fBar2;
    html += '<div class="arm alr"></div>';
    html += s2B;

    html += '</div>'; // .bgrid

    // Result banner
    html += resultBanner(final_, isSacko);

    // Breakdown section (per-round scores)
    html += breakdown(s1, s2, isSacko);

    html += '</div>'; // .bracket-wrap
    return html;
}

function isHighlighted(semi, side, isSacko) {
    if (!semi || !semi.hasData) return false;
    var agg = semi.aggregate;
    if (agg.a === null) return false;
    if (!isSacko) return side === 'A' ? agg.a >= agg.b : agg.b > agg.a;
    return side === 'A' ? agg.a <= agg.b : agg.b < agg.a;
}

function isFinalWinner(final_, side, isSacko) {
    var r = final_.round16;
    if (r.a === null || r.b === null) return false;
    if (!isSacko) return side === 'A' ? r.a >= r.b : r.b > r.a;
    return side === 'A' ? r.a <= r.b : r.b < r.a;
}

function finalist(semi, isSacko) {
    if (!semi || !semi.hasData) return null;
    var agg = semi.aggregate;
    if (agg.a === null) return null;
    if (!isSacko) return agg.a >= agg.b ? semi.teamA : semi.teamB;
    return agg.a <= agg.b ? semi.teamA : semi.teamB;
}

function teamBar(name, rank, score, highlighted, cls) {
    if (!name) {
        return '<div class="bar tbd-bar"><span class="bar-name">TBD</span></div>';
    }
    var hi = highlighted ? ' hi' : ' dim';
    return '<div class="bar ' + cls + hi + '">' +
        '<div class="bar-seed">' + (rank || '') + '</div>' +
        '<span class="bar-name">' + name + '</span>' +
        '<span class="bar-score">' + fmt(score) + '</span>' +
        '</div>';
}

function finalBar(name, score, cls, isWinner, isSacko) {
    if (!name) {
        return '<div class="bar fin-bar tbd-bar"><span class="bar-name">TBD</span></div>';
    }
    // In final: winner = champion (champ bracket) or loser = sacko (sacko bracket)
    var hi = isWinner ? ' hi' : '';
    return '<div class="bar fin-bar ' + cls + hi + '">' +
        '<span class="bar-name">' + name + '</span>' +
        '<span class="bar-score">' + fmt(score) + '</span>' +
        '</div>';
}

function resultBanner(final_, isSacko) {
    if (!final_) return '';
    var r = final_.round16;
    if (r.a === null || r.b === null) return '';
    var winner = r.a >= r.b ? final_.teamA : final_.teamB;
    if (isSacko) winner = r.a <= r.b ? final_.teamA : final_.teamB;
    var icon = isSacko ? '&#127814;' : '&#127942;';
    var word = isSacko ? 'SACKO' : 'CHAMPION';
    return '<div class="result-banner ' + (isSacko ? 'sacko' : 'champ') + '">' +
        icon + ' ' + word + ': <strong>' + winner + '</strong>' +
        '</div>';
}

function breakdown(s1, s2, isSacko) {
    if (!s1 && !s2) return '';
    var cls = isSacko ? 'sacko' : 'champ';
    var html = '<div class="bdown-wrap">';

    function teamLine(name, rank, r14, r15, agg) {
        if (!name) return '';
        return '<div class="bdown-row">' +
            '<span class="bdown-seed ' + cls + '">' + (rank || '') + '</span>' +
            '<span class="bdown-name">' + name + '</span>' +
            '<span class="bdown-scores">R14: ' + fmt(r14) +
            ' &nbsp; R15: ' + fmt(r15) +
            ' &nbsp; <strong>AGG: ' + fmt(agg) + '</strong></span>' +
            '</div>';
    }

    if (s1) {
        html += '<div class="bdown-label">Semi-Final 1</div>';
        html += teamLine(s1.teamA, s1.rankA, s1.round14.a, s1.round15.a, s1.aggregate.a);
        html += teamLine(s1.teamB, s1.rankB, s1.round14.b, s1.round15.b, s1.aggregate.b);
    }
    if (s2) {
        html += '<div class="bdown-label">Semi-Final 2</div>';
        html += teamLine(s2.teamA, s2.rankA, s2.round14.a, s2.round15.a, s2.aggregate.a);
        html += teamLine(s2.teamB, s2.rankB, s2.round14.b, s2.round15.b, s2.aggregate.b);
    }
    html += '</div>';
    return html;
}
