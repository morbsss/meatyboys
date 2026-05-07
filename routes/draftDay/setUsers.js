var express = require('express');

var router = express.Router();
var fs = require('fs');
var path = require('path');

var playerfilesDir = path.join(__dirname, '..', '..', 'playerfiles');

router.post('/', function(req, res, next) {
    fs.writeFile(path.join(playerfilesDir, 'users.txt'), req.body.userList, function (err) {
        //if (err) throw err;
       console.log('Saved!');
       res.send('success');
    });

	
});

module.exports = router;