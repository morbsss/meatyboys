var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');

var downloadsDir = path.join(__dirname, '..', 'downloads');

router.get('/', function(req, res, next) {
	var file = path.join(downloadsDir, 'round.json');
  	fs.readFile(file, function(err, data) {
		  //console.log("james", JSON.parse(data),"James");
		  res.send(JSON.parse(data));
  		
  		
  	});

});

module.exports = router;
