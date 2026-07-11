// server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import admin from "firebase-admin";
import { WebSocketServer } from "ws";

dotenv.config();


// =====================
// FIREBASE
// =====================

admin.initializeApp({

credential: admin.credential.cert({

projectId:
process.env.FIREBASE_PROJECT_ID,

clientEmail:
process.env.FIREBASE_CLIENT_EMAIL,

privateKey:
process.env.FIREBASE_PRIVATE_KEY
.replace(/\\n/g,"\n")

})

});


const db = admin.firestore();




// =====================
// EXPRESS
// =====================

const app = express();

app.use(cors());

app.use(express.json());



const PORT =
process.env.PORT || 8080;



app.get("/",(req,res)=>{

res.json({

status:"online",

game:"Werewolf Online Server",

time:Date.now()

});

});




// =====================
// WEBSOCKET SETUP
// =====================


const server =
app.listen(PORT,()=>{

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



function send(ws,data){

if(ws.readyState===1){

ws.send(
JSON.stringify(data)
);

}

}




function broadcast(room,data){

clients.forEach(ws=>{

if(
ws.room===room &&
ws.readyState===1
){

send(ws,data);

}

});

}




wss.on("connection",(ws)=>{


console.log(
"Player connected"
);



clients.push(ws);



send(ws,{

type:"connected",

message:"WebSocket online"

});




ws.on("message",async(msg)=>{


try{


let data =
JSON.parse(msg);



if(data.type==="join"){


ws.room=data.room;


send(ws,{

type:"joined",

room:data.room

});


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



}catch(e){

console.log(
"WS error",
e.message
);

}


});





ws.on("close",()=>{


clients =
clients.filter(
x=>x!==ws
);


});


});





// =====================
// ROOM UTILS
// =====================


function randomRoom(){


let chars=
"ABCDEFGH123456789";


let code="";


for(let i=0;i<4;i++){

code+=chars[
Math.floor(
Math.random()*chars.length
)
];

}


return code;

}



async function sendRoom(room){


let ref =
db.collection("rooms").doc(room);


let snap =
await ref.get();


if(!snap.exists)
return;



let data=snap.data();



let players =
await ref.collection("players").get();



let list=[];


players.forEach(p=>{

list.push({

id:p.id,

...p.data()

});

});



broadcast(room,{

type:"room",

room,

locked:data.locked,

maxPlayers:data.maxPlayers,

players:list

});


  }}





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

// =====================
// CREATE ROOM
// =====================


app.post("/room/create",async(req,res)=>{


try{


let {

uid,

maxPlayers,

locked

}=req.body;



let room;


do{

room=randomRoom();


let check =
await db.collection("rooms")
.doc(room)
.get();


if(!check.exists)
break;


}while(true);





let ref =
db.collection("rooms")
.doc(room);




await ref.set({

host:uid,

maxPlayers:
maxPlayers || 8,

locked:
locked || false,

status:"waiting",

createdAt:Date.now(),

lastActive:Date.now()

});





await ref.collection("players")
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



sendRoom(room);



}catch(e){


console.log(e);


res.status(500).json({

ok:false,

error:e.message

});


}


});









// =====================
// JOIN ROOM
// =====================


app.post("/room/join",async(req,res)=>{


try{


let {

uid,

room

}=req.body;




let ref =
db.collection("rooms")
.doc(room);



let snap =
await ref.get();




if(!snap.exists){

return res.json({

ok:false,

error:"Không tồn tại phòng"

});

}





let data =
snap.data();




if(data.locked){

return res.json({

ok:false,

error:"Phòng đã khóa"

});

}





let players =
await ref.collection("players")
.get();




if(players.size >= data.maxPlayers){

return res.json({

ok:false,

error:"Phòng đầy"

});

}




let seat=0;


let used=[];


players.forEach(p=>{

used.push(
p.data().seat
);

});



while(
used.includes(seat)
){

seat++;

}





await ref.collection("players")
.doc(uid)
.set({

name:"Player "+(seat+1),

avatar:"🙂",

seat,

ready:false

});
