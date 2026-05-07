var express = require('express');
var router = express.Router();
var fs = require('fs');
var path = require('path');

var downloadsDir = path.join(__dirname, '..', 'downloads');

router.post('/', function(req, res, next) {
	var roundNo = req.body["round"];
	var file = path.join(downloadsDir, 'draft' + roundNo + '.json');
  	fs.readFile(file, function(err, data) {
		  //console.log("james", JSON.parse(data),"James");
		  if(err){
			  res.send();
		  }else{
		  res.send(JSON.parse(data));
		  }
  		
  		
  	});

});

module.exports = router;
