var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');

var downloadsDir = path.join(__dirname, '..', 'downloads');

router.get('/:round', function(req, res, next) {
  fs.readFile(path.join(downloadsDir, 'scoreboard' + req.params.round + '.json'), function(err, data) {
		  //console.log("james", JSON.parse(data),"James");
		  if(err){
			res.send();
		}else{
		  res.send(JSON.parse(data));
		}
  	});
});

module.exports = router;
