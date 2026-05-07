var request = require('request');
var fs = require('fs');
var loc = require('./saveLocation');

fs.readFile(loc + 'downloads/round.json', function (err, data) {
	//console.log("james", JSON.parse(data),"James");
	var round = JSON.parse(data).round;
	fs.readFile(loc + 'downloads/currentseason.json', function (err, cS) {
		var currSeas = JSON.parse(cS);
		var roundDates = [];
		for (var i = 0; i < currSeas.length; i++) {
			if (currSeas[i].round === round) {
				roundDates.push(new Date(convertDate(currSeas[i].datetime)));
			}
		}
		var scoreArr = [];
		var uRoundDates = [];
		for (var i = 0; i < roundDates.length; i++) {
			var found = false;
			for (var j = 0; j < uRoundDates.length; j++) {
				if (roundDates[i].getDate() === uRoundDates[j].getDate()) {
					found = true;
				}
			}
			if (!found) {
				uRoundDates.push(roundDates[i]);
			}
		}
		function addZero(num) {
			if (num < 10) {
				return '0' + String(num)
			} else {
				return String(num)
			}
		}
		// Drop Invalid Date entries (e.g. single-digit days like "8/05/2026" that
		// convertDate doesn't zero-pad — fixed below, but guard here too)
		uRoundDates = uRoundDates.filter(function(d) { return !isNaN(d.getTime()); });

		if (uRoundDates.length === 0) {
			fs.writeFile(loc + 'downloads/scoreboard' + round + '.json', JSON.stringify(scoreArr), function (err) {
				console.log('Saved! (no valid dates for round ' + round + ')');
			});
			return;
		}

		var returnTally = 0;
		for (var i = 0; i < uRoundDates.length; i++) {
			var dateTag = String(uRoundDates[i].getFullYear()) + addZero((uRoundDates[i].getMonth() + 1)) + addZero(uRoundDates[i].getDate());
			request({
				gzip: true,
				json: true,
				url: 'https://site.web.api.espn.com/apis/site/v2/sports/rugby/scorepanel?contentorigin=espn&dates=' + dateTag + '&lang=en&region=us'
			}, async function (error, response, body) {
				if (!error && body && body.scores) {
					var legs = body.scores;
					var leg = {};
					for (var i = 0; i < legs.length; i++) {
						if (legs[i].leagues && legs[i].leagues[0] && legs[i].leagues[0].name === "Super Rugby Pacific") {
							leg = legs[i];
						}
					}
					var comps = leg.events;
					if (comps) {
						for (var i = 0; i < comps.length; i++) {
							scoreArr.push(comps[i].competitions[0].competitors[0])
							scoreArr.push(comps[i].competitions[0].competitors[1])
						}
					}
				} else {
					console.log('Scoreboard API error or empty response for date', dateTag, error || (body && body.message) || '');
				}
				returnTally++;
				if (returnTally === uRoundDates.length) {
					console.log(scoreArr)
					fs.writeFile(loc + 'downloads/scoreboard' + round + '.json', JSON.stringify(scoreArr), function (err) {
						console.log('Saved!');
					});
				}
			});
		}

	});
});


function convertDate(date) {
	date = date.split("/");
	var day = ('0' + date[0]).slice(-2);
	var month = ('0' + date[1]).slice(-2);
	var year = date[2].split(" ");
	date = year[0] + "-" + month + "-" + day;
	time = year[1];
	date = date + "T" + time;
	return date;
}