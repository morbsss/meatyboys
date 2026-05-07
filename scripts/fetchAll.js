var { execSync } = require('child_process');
var fs = require('fs');
var path = require('path');

var ROOT        = path.join(__dirname, '..');
var saveScripts = path.join(ROOT, 'saveScripts');
var roundFile   = path.join(ROOT, 'downloads', 'round.json');

var FROM    = 1;
var TO      = 13;
var CURRENT = 13;

function run(script) {
    execSync('node ' + path.join(saveScripts, script), { stdio: 'inherit', cwd: ROOT });
}

function setRound(n) {
    fs.writeFileSync(roundFile, JSON.stringify({ round: n, official: n }));
}

function step(label, fn) {
    try {
        fn();
    } catch (e) {
        console.error('  FAILED ' + label + ': ' + (e.message || e));
    }
}

console.log('Refreshing cookie...');
run('getCookie.js');

for (var round = FROM; round <= TO; round++) {
    console.log('\n=== Round ' + round + ' / ' + TO + ' ===');
    setRound(round);
    step('saveDraft',       function() { run('saveDraft.js'); });
    step('getPlayerScores', function() { run('getPlayerScores.js'); });
    step('saveScoreboard',  function() { run('saveScoreboard.js'); });
}

console.log('\nRestoring round.json → ' + CURRENT);
setRound(CURRENT);
console.log('Done. Rounds ' + FROM + '-' + TO + ' fetched.');
