var express = require('express');

var router = express.Router();
var fs = require('fs');
var path = require('path');

var playerfilesDir = path.join(__dirname, '..', '..', 'playerfiles');

router.get('/', function(req, res, next) {
  fs.readFile(path.join(playerfilesDir, 'time.txt'), function(err, data) {
          //console.log("james", JSON.parse(data),"James");
          try {
            console.log(JSON.parse(data).time);
            res.send(JSON.parse(data))
          }catch(err){
            setTimeout(function(){fs.readFile('playerfiles/time.txt', function(err, data) {
                    console.log(JSON.parse(data).time);
                    res.send(JSON.parse(data))
                });       
            },50);
          }
          
  	});

	
});

module.exports = router;


