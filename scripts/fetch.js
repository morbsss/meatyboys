var { execSync } = require('child_process');
var path = require('path');

var ROOT = path.join(__dirname, '..');
var saveScripts = path.join(ROOT, 'saveScripts');

function run(script) {
  console.log('\nRunning ' + script + '...');
  execSync('node ' + path.join(saveScripts, script), {
    stdio: 'inherit',
    cwd: ROOT
  });
}

run('getCookie.js');
run('saveRound.js');
run('saveDraft.js');
run('getPlayerScores.js');
run('saveScoreboard.js');

console.log('\nDone. Live data saved. Run: npm run dev');
