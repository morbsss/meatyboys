var express = require('express');
var users = require('../playerfiles/userLogins');

var router = express.Router();
var fs = require('fs');
var path = require('path');

var playerfilesDir = path.join(__dirname, '..', 'playerfiles');
/* GET home page. */
router.get('/:toChange', function(req, res, next) {
    res.send('success');
    //console.log(JSON.stringify(req));
    var start = new Date();
    var currUser = users[0].usr;
    var selectionTime = 92 * 1000;
    var timeobj = {time:start,usr:currUser,snake:"up"};
    console.log("Start Timer is:" + req.params.toChange);
    if(req.params.toChange=="start"){       
        fs.writeFile(path.join(playerfilesDir, 'time.txt'), JSON.stringify(timeobj), function (err) {
            //if (err) throw err;
        console.log('Saved start time');
        });
        var x = setInterval(function(){
            
        getTimeData().then((body)=>{            
            start = body.time;
            currUser = body.usr;
            if(((new Date())-(new Date(start)))>=selectionTime){ 
                const nxtU = nextUser(currUser,users,body.snake);
                currUser = users[nxtU.u].usr;
                start = new Date();
                timeobj = {time:start,usr:currUser,snake:nxtU.s};
                setTimeDate(timeobj);
                
            }
         })
        },500);
    }else if(req.params.toChange=="false"){
        getTimeData().then((body)=>{   
            console.log(JSON.stringify(body));     
            var user = body.usr;
            start = new Date();
            const nxtU = nextUser(user,users,body.snake);
            console.log("Changing to user: "+users[nxtU.u].usr);
            timeobj = {time:start,usr:(users[nxtU.u].usr),snake:nxtU.s}
            setTimeDate(timeobj);
        });
        
    }else{
        var timeout = Number(req.params.toChange);
        getTimeData().then((body)=>{
            var waitTill = new Date(body.time);
            waitTill = waitTill.setTime(waitTill.getTime() + (timeout*1000*60));
            waitTill = new Date(waitTill);
            var UserNow = body.usr;
            console.log("Adding time to user: "+UserNow);
            timeobj = {time:waitTill,usr:UserNow,snake:body.snake}
            setTimeDate(timeobj);

        });
    }
    

	
});
function getTimeData(){
    return new Promise((resolve,reject)=>{
        fs.readFile(path.join(playerfilesDir, 'time.txt'), function(err, data) {
            try {
                resolve(JSON.parse(data));
              }catch(err){
                setTimeout(function(){fs.readFile('playerfiles/time.txt', function(err, data) {
                    resolve(JSON.parse(data));
                    });       
                },50);
              }
            
            
        });
  
    });
}
function setTimeDate(obj){
    fs.writeFile('playerfiles/time.txt', JSON.stringify(obj), function (err) {
        
        console.log('Saved time');
     });
}
function nextUser(user,users,snake){
    var userID = -1;
    for(var i =0;i<users.length;i++ ){
        if(users[i].usr==user){
            userID = i;
        }
    }
    console.log(user,snake);
    if(userID>=(users.length-2)){//all user is at end
        if(snake=='up'){
            snake ='top'            
        }else{
            userID--;
            snake = 'down'
        }
    }else if(userID==0){
        if(snake=='down'){
            snake ='bottom'            
        }else{
            userID++;
            snake ='up'
        }
    }else if(snake=='up'){
        userID++;
    }else if(snake=='down'){
        userID--;
    }
    return {u:userID,s:snake};
}
module.exports = router;


