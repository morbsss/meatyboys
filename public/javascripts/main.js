
var gRound = 1;
var Round = [];
var users = [];
var draftData = [];
var sortBy = 0;
var currData = [];
var nameLength = 12;
var matchNo = 0;
var roundFirstLoad = 0;
$(document).ready(function () {
	$.get('/getRound', function (roundD) {
		gRound = { draft: roundD.round, match: 0 };

		listRounds(16);//set to latest round
		getCurrentSeason().then((currD) => {
			currData = currD;
			gRound.match = getCurrentMatch(gRound.draft);
			getDraft().then(() => {
				roundsThisWeek();
				fillData();
			});

		})
	});
});
// function getRound() {
// 	$.get('/getPlayers/' + gRound.official, function (data) {
// 		//console.log(data)
// 		Round = (data);
// 		getDraft().then(() => {
// 			roundsThisWeek();
// 			getCurrentSeason();
// 			fillData();
// 		});
// 	});
// }
function refreshData() {
	getDraft().then(() => {
		fillData();
	});
}
function getCurrentSeason() {
	return new Promise((resolve, reject) => {
		$.get('/getcurrSeason', function (data) {
			//console.log(data)
			resolve(data);
		});
	})
}


function getDraft() {
	return new Promise((resolve, reject) => {

		$.post('/getDraft', { "round": ((gRound.draft)) }, function (data) {
			//console.log(data)
			draftData = (data);
			resolve();
		});
	});
}
function listRounds(noRounds) {
	var roundList = '';
	for (var i = 0; i < noRounds; i++) {
		roundList = roundList + '<li><a href="javascript:;" onclick="setRound(' + ((i + 1)) + ')" id="priceChanges" data-toggle="collapse" data-target=".navbar-collapse.in" >Round ' + (i + 1) + '</a></li>'
	}
	document.getElementById("roundList").innerHTML = roundList;
}

function toggleSortBy() {
	var button = document.getElementById("sortBy");
	if (sortBy == 0) {
		sortBy = 1;
		button.firstChild.data = "Sort by Score";
	} else {
		sortBy = 0;
		button.firstChild.data = "Sort by Position";
	}
	fillData();
}


var timer = setInterval(refreshData, 30000);


var loadedOnce = 0;

function setZoom() {
	if (screen.width < 992) {
		document.getElementById("navZoom").style.zoom = 2;
		document.getElementById("dashSpace").style.paddingTop = '110px';
		var navBrandMob = document.getElementById("headerNav").innerHTML;
		if (loadedOnce == 0) {
			document.getElementById("headerNav").innerHTML = navBrandMob + '<a class="navbar-brand" href="#">Fantasy Meaty Boys</a>'
			loadedOnce += 1;
		}
	}
	if ((screen.width < 1700) && (screen.width > 992)) {
		var zoomCalc = (screen.width - 992) / (1700 - 992) * .5 + .5;
		console.log(zoomCalc);
		document.getElementById("navZoom").style.zoom = zoomCalc;
	}
}
function setRound(round) {
	console.log(round, findMatchfromRound(round));
	changeMatch(findMatchfromRound(round))
}
function nameMod (name) {
	var currentTeamList = ["Crusaders", "Brumbies", "Hurricanes", "Chiefs", "Highlanders", "Blues", "Force", "Waratahs", "Reds", "Moana Pasifika", "Fijian Drua"];

	if(name==="New South Wales Waratahs"){
		return "Waratahs";
	}
	if(name==="Queensland Reds"){
		return "Reds";
	}
	if(name==="Western Force"){
		return "Force";
	}
	return name;
}
function getScore() {
	$.get('/getScoreboard/' + gRound.draft, function (score) {
		console.log(score);
		var currGame = currData[gRound.match];
		var teamA = {}
		var teamB = {}
		for(var i=0;i<score.length;i++){
			if(score[i].team){
				if(currGame["Team 1"]===nameMod(score[i].team.name)){
					teamA = score[i];
				}
				if(currGame["Team 2"]===nameMod(score[i].team.name)){
					teamB = score[i];
				}
			}
		}
		document.getElementById("scoreHome").innerHTML = " " + teamA.score;
		document.getElementById("scoreAway").innerHTML = teamB.score;
	})
}

function nameSwap(name) {
	if (name === 'Western Force') {
		return 'Force';
	}
	return name;
}

function getCurrentMatch(rnd) {
	var currMatch = 0;
	var found = false;
	for (var i = 0; i < currData.length; i++) {
		if (currData[i].round === rnd && currData[i].homeaway === 'home') {
			if (new Date(convertDate(currData[i].datetime)) < new Date()) {
				currMatch = i;
				found = true;
			}
		}
	}
	if (!found) {
		currMatch = findMatchfromRound(rnd)
	}
	console.log(currMatch)
	return currMatch;
}
function fillData() {
	var homeName = nameSwap(currData[gRound.match]["Team 1"]);
	var awayName = nameSwap(currData[gRound.match]["Team 2"]);
	document.getElementById("round").innerHTML = "Round " + ((gRound.draft)) + '<span class="caret"></span>';
	document.getElementById("homeT").innerHTML = homeName + '<span id="scoreHome"></span>';
	document.getElementById("awayT").innerHTML = '<span id="scoreAway"></span> ' + awayName;
	getScore();
	var team1 = [];
	var team2 = [];
	var table = document.getElementById("playerTable");
	var list = "";
	var team1Name = (homeName);
	var team2Name = (awayName);
	//Draft player name
	for (var i = 0; i < draftData.length; i++) {
		if (draftData[i].team == team1Name) {

			var posDetails = getPos(draftData[i].position);


			var t1Score = 0;
			t1Score = draftData[i].score;


			var ownerName = "";
			if ((draftData[i].userName != "Free Agent") && (draftData[i].userName.slice(0, 7) != "WAIVERS")) {
				if (draftData[i].bench) {
					ownerName = draftData[i].userName + ' (Bench)';
				} else {
					ownerName = draftData[i].userName;

				}
			}
			team1.push({
				name: draftData[i].playerName,
				status: draftData[i].teamNews,
				owner: ownerName,
				score: t1Score,
				position: posDetails.posNum,
				posName: posDetails.posName,
				img: '',
				status: ((draftData[i].teamNews === 'Starting') ? 'fas fa-star' : (draftData[i].teamNews === 'Bench') ? 'fas fa-star-half-alt' : (draftData[i].teamNews === 'Out') ? 'far fa-star' : '')
			});
		} else if (draftData[i].team == team2Name) {
			var posDetails = getPos(draftData[i].position);



			var t2Score = 0;
			t2Score = draftData[i].score;


			var ownerName = "";
			if ((draftData[i].userName != "Free Agent") && (draftData[i].userName.slice(0, 7) != "WAIVERS")) {
				if (draftData[i].bench) {
					ownerName = draftData[i].userName + ' (Bench)';
				} else {
					ownerName = draftData[i].userName;

				}
			}
			team2.push({
				name: draftData[i].playerName,
				owner: ownerName,
				score: t2Score,
				position: posDetails.posNum,
				posName: posDetails.posName,
				img: '',
				status: ((draftData[i].teamNews === 'Starting') ? 'fas fa-star' : (draftData[i].teamNews === 'Bench') ? 'fas fa-star-half-alt' : (draftData[i].teamNews === 'Out') ? 'far fa-star' : '')
			});
		}

	}
	var blankObj = {
		name: '',
		score: '',
		playerId: '',
		position: '',
		posName: '',
		owner: '',
		img: ''
	}
	var lColor = chooseColour(team1Name);
	var rColor = chooseColour(team2Name);
	var diff = 0;
	if (sortBy == 1) {
		team1.sort(function (a, b) { return a.position - b.position });
		team2.sort(function (a, b) { return a.position - b.position });
	} else {
		team1.sort(function (a, b) { return b.score - a.score });
		team2.sort(function (a, b) { return b.score - a.score });
	}
	if (team1.length < team2.length) {
		diff = team2.length - team1.length;
		for (var l = 0; l < diff; l++) {
			team1.push(blankObj);
		}
	} else if (team1.length > team2.length) {
		diff = team1.length - team2.length;
		for (var l = 0; l < diff; l++) {
			team2.push(blankObj);
		}
	}

	for (var i = 0; i < team1.length; i++) {
		list = list + '<tr class="myRow">\
			<td width="5%" style="background-color:'+ lColor + '">\
			<div class="rOwner">\
			'+ team1[i].owner + '\
			</div>\
			</td >\
			<td width="5%" style="background-color:'+ lColor + '">\
			<div class="rScore">\
			'+ team1[i].score + '\
			</div>\
			</td>\
			<td width="31%" style="background-color:'+ lColor + '">\
			<div class="rName">\
			'+ team1[i].name + '<i style="font-size:20px" class="' + team1[i].status + '"></i>\
			</div>\
			</td>\
			<td width="5%" class="rImg" style="background-color:'+ lColor + '">\
			'+ team1[i].img + '\
			</td>\
			<td width="3%" style="background-color:'+ lColor + '">\
			<div class="verticaltext">\
			'+ team1[i].posName + '\
			</div>\
			</td>\
			<td width="2%" >\
			<br>\
			VS\
			</td>\
			<td width="3%"  style="background-color:'+ rColor + '">\
			<div class="verticaltext">\
			'+ team2[i].posName + '\
			</div>\
			</td>\
			<td width="5%"  class="rImg" style="background-color:'+ rColor + '">\
			'+ team2[i].img + '\
			</td>\
			<td width="31%" style="background-color:'+ rColor + '">\
			<div class="rName">\
			'+ team2[i].name + '<i style="font-size:20px" class="' + team2[i].status + '"></i>\
			</div>\
			</td>\
			<td width="5%"style="background-color:'+ rColor + '">\
			<div class="rScore">\
			'+ team2[i].score + '\
			</div>\
			</td>\
			<td width="5%" style="background-color:'+ rColor + '">\
			<div class="rOwner">\
			'+ team2[i].owner + '\
			</div>\
			</td>\
		</tr>'}
	document.getElementById("loader").style.display = "none";

	table.innerHTML = list;
	setZoom();
}

$(function () {
	//Enable swiping...
	$("#dashSpace").swipe({
		//Generic swipe handler for all directions
		swipe: function (event, direction, distance, duration, fingerCount, fingerData) {
			//$(this).text("You swiped " + direction );
			var tempMN = 0;
			var curRoun = gRound.draft;
			if (direction == "right") {
				tempMN = gRound.match - 1;
				if (currData[tempMN].round === curRoun) {
					changeMatch(tempMN);
				}
			} else if (direction == "left") {
				tempMN = gRound.match + 1;
				if (currData[tempMN].round === curRoun) {
					changeMatch(tempMN);
				}
			}
		},
		//Default is 75px, set to 0 for demo so any distance triggers swipe
		//threshold:0
		allowPageScroll: "vertical"
	});
});
function roundsThisWeek() {
	var navBar = '';
	var teams = [];
	console.log(gRound.draft);
	for (var i = 0; i < currData.length; i++) {
		if (currData[i].round === gRound.draft && currData[i].homeaway === 'home') {
			console.log(currData[i].round, gRound.draft)
			var homeTeam = nameSwap(currData[i]["Team 1"]);
			var awayTeam = nameSwap(currData[i]["Team 2"]);
			teams.push((homeTeam));
			teams.push((awayTeam));
			navBar = navBar + '<li><a data-toggle="collapse" data-target=".navbar-collapse.in" href="javascript:;" onClick="changeMatch(' + i + ')">' + homeTeam + ' v ' + awayTeam + '</a></li>';
		}
	}

	document.getElementById("games").innerHTML = navBar;
	var currentTeamList = ["Crusaders", "Brumbies", "Hurricanes", "Chiefs", "Highlanders", "Blues", "Force", "Waratahs", "Reds", "Moana Pasifika", "Fijian Drua"];
	var byes = '';
	var found = 0;
	for (var i = 0; i < currentTeamList.length; i++) {
		for (var j = 0; j < teams.length; j++) {
			if (teams[j] === currentTeamList[i]) {
				found = 1;
			}
		}

		if (found == 0) {
			byes = byes + '<li><a data-toggle="collapse" data-target=".navbar-collapse.in" href="javascript:;" >' + currentTeamList[i] + '</a></li>';
		}
		found = 0;
	}
	document.getElementById("byes").innerHTML = byes;


}
function changeMatch(match) {
	console.log(match)
	var prevR = gRound.draft;
	gRound.match = match;
	gRound.draft = currData[match].round;
	roundsThisWeek();
	if (currData[match].round === prevR) {
		console.log('in')
		fillData();
	} else {
		console.log(gRound.draft)
		getDraft().then(() => {
			fillData();
		})
	}
}

function chooseColour(team) {
	var colour = ''
	switch (team) {
		case "Stormers":
			colour = "#005596"
			break;
		case "Crusaders":
			colour = "#ED092E"
			break;
		case "Lions":
			colour = "#FF0000"
			break;
		case "Brumbies":
			colour = "#FFC222"
			break;
		case "Hurricanes":
			colour = "#FFDB01"
			break;
		case "Chiefs":
			colour = "#F4B939"
			break;
		case "Sharks":
			colour = "#FFFFFF"
			break;
		case "Highlanders":
			colour = "#104d87"
			break;
		case "Jaguares":
			colour = "#FFC336"
			break;
		case "Blues":
			colour = "#11ACEC"
			break;
		case "Force":
			colour = "#3A73B8"
			break;
		case "Cheetahs":
			colour = "#F07D3C"
			break;
		case "Waratahs":
			colour = "#8EBAE5"
			break;
		case "Bulls":
			colour = "#52b9FC"
			break;
		case "Kings":
			colour = "#C39410"
			break;
		case "Reds":
			colour = "#B90D3B"
			break;
		case "Sunwolves":
			colour = "#E60012"
			break;
	}
	return colour;


}
function getPos(posRef) {
	var posName = '';
	var posRank = '';
	switch (posRef) {
		case "Front Row":
			posName = "FRW";
			posNum = 0;
			break;
		case "Lock":
			posName = "LOC";
			posNum = 1;
			break;
		case "Loose Forward":
			posName = "BKR";
			posNum = 2;
			break;
		case "Half Back":
			posName = "SHV";
			posNum = 3;
			break;
		case "Fly Half":
			posName = "FLH";
			posNum = 4;
			break;
		case "Midfielder":
			posName = "CTR";
			posNum = 5;
			break;
		case "Outside Back":
			posName = "OBK";
			posNum = 6;
			break;
	}
	return { 'posName': posName, 'posNum': posNum };


}

function findDraftRound(round, getGames) {
	var roundGroupings = [[0, 1], [2, 5], [6, 9], [10, 13], [14, 17], [18, 21], [22, 25], [26, 29], [30, 33], [34, 37], [38, 39]];
	for (var i = 0; i < roundGroupings.length; i++) {
		if ((roundGroupings[i][0] <= round) && (round <= roundGroupings[i][1])) {
			if (getGames) {
				return roundGroupings[i];
			} else {
				return i + 1;

			}
		}
	}
}
function findMatchfromRound(rn) {
	for (var i = 0; i < currData.length; i++) {
		if (currData[i].round === rn) {
			return i;
		}
	}
}

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