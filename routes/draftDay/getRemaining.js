var express = require('express');

var router = express.Router();
var fs = require('fs');
var path = require('path');

var playerfilesDir = path.join(__dirname, '..', '..', 'playerfiles');

router.get('/', function(req, res, next) {
  fs.readFile(path.join(playerfilesDir, 'allplayers.txt'), function(err, data) {
  		//console.log("james", JSON.parse(data),"James");
  		res.send(JSON.parse(data));
  	});

	
});

module.exports = router;


