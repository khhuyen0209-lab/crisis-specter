// server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { WebSocketServer } from "ws";

dotenv.config();


// ======================
// FIREBASE ADMIN
// ======================

admin.initializeApp({

credential:
admin.credential.cert({

projectId:
process.env.FIREBASE_PROJECT_ID,

clientEmail:
process.env.FIREBASE_CLIENT_EMAIL,

privateKey:
process.env.FIREBASE_PRIVATE_KEY
.replace(/\\n/g,"\n")

})

});


const db =
admin.firestore();




// ======================
// EXPRESS
// ======================


const app =
express();


app.use(cors());

app.use(express.json());



const PORT =
process.env.PORT || 8080;





// ======================
// TEST SERVER
// ======================


app.get("/",(req,res)=>{


res.json({

status:"online",

game:"Werewolf Online Server"

});


});






// ======================
// CREATE ROOM
// ======================


function randomRoom(){


let chars =
"ABCDEFGH123456789";


let code="";


for(let i=0;i<4;i++){


code +=
chars[
Math.floor(
Math.random()*chars.length
)
];


}


return code;

}





app.post(
"/room/create",
async(req,res)=>{


try{


let {

uid,

maxPlayers,

locked

}=req.body;



let room =
randomRoom();



await db
.collection("rooms")
.doc(room)
.set({

host:uid,

maxPlayers:
maxPlayers || 8,

locked:
locked || false,

status:"waiting",

createdAt:
Date.now(),

lastActive:
Date.now()


});





await db
.collection("rooms")
.doc(room)
.collection("players")
.doc(uid)
.set({

name:"Player",

avatar:"👑",

seat:0,

ready:true


});





res.json({

ok:true,

room

});



}catch(e){


console.log(e);


res.status(500)
.json({

error:e.message

});


}



});







// ======================
// JOIN ROOM
// ======================


app.post(
"/room/join",
async(req,res)=>{


let {

uid,

room

}=req.body;



let ref =
db.collection("rooms")
.doc(room);



let snap =
await ref.get();



if(!snap.exists)

return res.json({

ok:false,

error:"Không tồn tại phòng"

});




let data =
snap.data();



if(data.locked)

return res.json({

ok:false,

error:"Phòng đã khóa"

});





let players =
await ref.collection("players")
.get();



if(players.size >= data.maxPlayers)

return res.json({

ok:false,

error:"Phòng đầy"

});





let seat =
players.size;



await ref
.collection("players")
.doc(uid)
.set({

name:"Player "+(seat+1),

avatar:"🙂",

seat,

ready:false


});





await ref.update({

lastActive:
Date.now()

});





res.json({

ok:true

});


});







// ======================
// READY
// ======================


app.post(
"/room/ready",
async(req,res)=>{


let {

uid,

room

}=req.body;



let ref =
db.collection("rooms")
.doc(room)
.collection("players")
.doc(uid);



let snap =
await ref.get();



if(!snap.exists)

return res.json({

ok:false

});



await ref.update({

ready:
!snap.data().ready

});



res.json({

ok:true

});


});








// ======================
// WEBSOCKET
// ======================


const server =
app.listen(
PORT,
()=>{

console.log(
"Server running:",
PORT
);

});




const wss =
new WebSocketServer({

server

});



let clients=[];



wss.on(
"connection",
(ws)=>{


clients.push(ws);



console.log(
"Player connected"
);




ws.on(
"message",
async(message)=>{


let data =
JSON.parse(message);



if(data.type==="join"){


ws.room =
data.room;


}






if(data.type==="chat"){


broadcast(

data.room,

{

type:"chat",

name:data.uid,

text:data.text

}

);


}



});





ws.on(
"close",
()=>{


clients =
clients.filter(
c=>c!==ws
);


});


});








function broadcast(room,data){


clients.forEach(ws=>{


if(

ws.room===room &&
ws.readyState===1

){


ws.send(

JSON.stringify(data)

);


}


});


  }
