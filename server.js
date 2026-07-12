// server.js P1/2

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

        version:"V2"

    });

});





// =====================
// WEBSOCKET
// =====================

let clients = [];



function send(ws,data){

    if(ws.readyState === 1){

        ws.send(
            JSON.stringify(data)
        );

    }

}



function broadcast(room,data){

    clients.forEach(ws=>{

        if(
            ws.room === room &&
            ws.readyState === 1
        ){

            send(ws,data);

        }

    });

}





// =====================
// ROOM UTILS
// =====================


function randomRoom(){

    const chars =
    "ABCDEFGH123456789";


    let code = "";


    for(
        let i=0;
        i<4;
        i++
    ){

        code +=
        chars[
            Math.floor(
                Math.random()*chars.length
            )
        ];

    }


    return code;

}




async function sendRoom(room){

    const ref =
    db.collection("rooms")
    .doc(room);



    const snap =
    await ref.get();



    if(!snap.exists)
    return;



    const data =
    snap.data();



    const players =
    await ref
    .collection("players")
    .get();



    let list = [];



    players.forEach(p=>{

        list.push({

            id:p.id,

            ...p.data()

        });

    });



    broadcast(room,{

        type:"room",

        room,


        // chủ phòng

        host:data.host,


        // trạng thái phòng

        locked:data.locked,

        maxPlayers:data.maxPlayers,

        status:data.status,

        lastActive:data.lastActive,


        // người chơi

        players:list


    });


}






// =====================
// START SERVER
// =====================


const server =
app.listen(PORT,()=>{


    console.log(
        "🚀 Server running on port",
        PORT
    );


});





const wss =
new WebSocketServer({

    server

});





console.log(
    "🐺 Werewolf Server Ready"
);





// =====================
// CREATE ROOM
// =====================


app.post(
"/room/create",
async(req,res)=>{


try{


const {

uid,

maxPlayers,

locked

}=req.body;



let room;



while(true){


    room = randomRoom();



    const check =
    await db.collection("rooms")
    .doc(room)
    .get();



    if(!check.exists)
    break;


}




const ref =
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

    ready:true,

    lastSeen:Date.now()

});





await sendRoom(room);



res.json({

    ok:true,

    room

});



}
catch(e){


res.status(500).json({

    ok:false,

    error:e.message

});


}


});






// =====================
// JOIN ROOM
// =====================


app.post(
"/room/join",
async(req,res)=>{


try{


const {

uid,

room

}=req.body;



const ref =
db.collection("rooms")
.doc(room);



const snap =
await ref.get();



if(!snap.exists){

return res.json({

    ok:false,

    error:"Không tồn tại phòng"

});

}



const data =
snap.data();




if(data.locked){

return res.json({

    ok:false,

    error:"Phòng khóa"

});

}



const players =
await ref.collection("players")
.get();



if(players.size >= data.maxPlayers){

return res.json({

    ok:false,

    error:"Phòng đầy"

});

}



let seat = 0;

let used = [];



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

    ready:false,

    lastSeen:Date.now()

});



await ref.update({

    lastActive:Date.now()

});



await sendRoom(room);



res.json({

    ok:true

});



}
catch(e){


res.status(500).json({

    ok:false,

    error:e.message

});


}


});
// server.js P2/2


// =====================
// READY
// =====================

app.post(
"/room/ready",
async(req,res)=>{


try{


const {

uid,

room

}=req.body;



const ref =
db.collection("rooms")
.doc(room)
.collection("players")
.doc(uid);




const snap =
await ref.get();



if(!snap.exists){

return res.json({

    ok:false,

    error:"Không tìm thấy người chơi"

});

}



await ref.update({

    ready:
    !snap.data().ready

});



await sendRoom(room);



res.json({

    ok:true

});



}
catch(e){


res.status(500).json({

    ok:false,

    error:e.message

});


}


});







// =====================
// LEAVE ROOM
// =====================

app.post(
"/room/leave",
async(req,res)=>{


try{


const {

uid,

room

}=req.body;




const roomRef =
db.collection("rooms")
.doc(room);




await roomRef
.collection("players")
.doc(uid)
.delete();


await transferHostWhenLeave(room,uid);


const players =
await roomRef.collection("players").get();


if(!players.empty){

await roomRef.update({
lastActive:Date.now()
});

await sendRoom(room);

}

else{


await roomRef.update({

    lastActive:Date.now()

});


await sendRoom(room);


}



res.json({

    ok:true

});



}
catch(e){


res.status(500).json({

    ok:false,

    error:e.message

});


}


});




// =====================
// KICK PLAYER
// =====================

app.post("/room/kick", async(req,res)=>{

try{


const {
host,
target,
room
}=req.body;



const roomRef =
db.collection("rooms")
.doc(room);



const snap =
await roomRef.get();



if(!snap.exists){

return res.json({

ok:false,

error:"Phòng không tồn tại"

});

}



const data =
snap.data();



if(data.host !== host){

return res.json({

ok:false,

error:"Bạn không phải chủ phòng"

});

}



if(target === host){

return res.json({

ok:false,

error:"Không thể đá chính mình"

});

}



await roomRef
.collection("players")
.doc(target)
.delete();



await roomRef.update({

lastActive:Date.now()

});



await sendRoom(room);



res.json({

ok:true

});



}
catch(e){

res.status(500).json({

ok:false,

error:e.message

});

}

});





// =====================
// TRANSFER HOST
// =====================

app.post("/room/transfer", async(req,res)=>{

try{


const {
host,
target,
room
}=req.body;



const roomRef =
db.collection("rooms")
.doc(room);



const snap =
await roomRef.get();



if(!snap.exists){

return res.json({

ok:false,

error:"Phòng không tồn tại"

});

}



const data =
snap.data();



if(data.host !== host){

return res.json({

ok:false,

error:"Bạn không phải chủ phòng"

});

}



const targetPlayer =
await roomRef
.collection("players")
.doc(target)
.get();



if(!targetPlayer.exists){

return res.json({

ok:false,

error:"Người chơi không có trong phòng"

});

}



await roomRef.update({

host:target,

lastActive:Date.now()

});



await sendRoom(room);



res.json({

ok:true

});


}
catch(e){

res.status(500).json({

ok:false,

error:e.message

});

}

});





// =====================
// AUTO TRANSFER WHEN HOST LEAVE
// =====================

async function transferHostWhenLeave(room,uid){


const roomRef =
db.collection("rooms")
.doc(room);



const snap =
await roomRef.get();



if(!snap.exists)
return;



const data =
snap.data();



if(data.host !== uid)
return;



const players =
await roomRef
.collection("players")
.get();



let newHost=null;



players.forEach(p=>{

if(!newHost){

newHost=p.id;

}

});



if(newHost){


await roomRef.update({

host:newHost,

lastActive:Date.now()

});


}
else{


await roomRef.delete();


}


}




// =====================
// QUICK JOIN
// =====================

app.get(
"/room/quick",
async(req,res)=>{


try{


const rooms =
await db.collection("rooms")
.where(
"status",
"==",
"waiting"
)
.get();




let found = null;




for(const r of rooms.docs){


const data =
r.data();



if(data.locked)
continue;



const players =
await r.ref
.collection("players")
.get();



if(players.size < data.maxPlayers){


found = r.id;

break;


}


}



res.json({

    room:found

});



}
catch(e){


res.status(500).json({

    error:e.message

});


}


});








// =====================
// CHAT HISTORY
// =====================

app.get(
"/room/:id/chat",
async(req,res)=>{


try{


const snap =
await db.collection("rooms")
.doc(req.params.id)
.collection("chat")
.orderBy("time","asc")
.limit(100)
.get();



let list=[];



snap.forEach(x=>{


list.push(
x.data()
);


});



res.json(list);



}
catch(e){


res.status(500).json({

    error:e.message

});


}


});







// =====================
// AUTO DELETE ROOM
// =====================

setInterval(async()=>{


try{


const now =
Date.now();



const rooms =
await db.collection("rooms")
.get();




for(const room of rooms.docs){


const data =
room.data();



const players =
await room.ref
.collection("players")
.get();




if(

players.empty &&

now - data.lastActive >
15 * 60 * 1000

){


await room.ref.delete();



console.log(

"🗑 Deleted room:",

room.id

);


}



}



}
catch(e){


console.log(

"Auto delete error:",

e.message

);


}


},60000);








// =====================
// WEBSOCKET MESSAGE
// =====================


wss.on("connection",(ws)=>{


console.log(
"🔌 WebSocket connected"
);



clients.push(ws);




send(ws,{

    type:"connected",

    message:"WebSocket online"

});





ws.on("message",async(msg)=>{


try{


const data =
JSON.parse(msg);





if(data.type==="join"){


ws.room =
data.room;



send(ws,{

    type:"joined",

    room:data.room

});



await sendRoom(data.room);



}



if(data.type==="ping"){

const ref =
db.collection("rooms")
.doc(data.room)
.collection("players")
.doc(data.uid);


const snap =
await ref.get();


if(snap.exists){

await ref.update({

lastSeen:Date.now()

});

}

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




}
catch(e){


console.log(

"WS Error:",

e.message

);


}



});







ws.on("close",()=>{


clients =
clients.filter(

c=>c!==ws

);


});



});

async function checkOffline(){

const now = Date.now();


const rooms =
await db.collection("rooms").get();



for(const room of rooms.docs){


const players =
await room.ref
.collection("players")
.get();



for(const p of players.docs){


const data =
p.data();



if(
data.lastSeen &&
now - data.lastSeen > 120000
){

await p.ref.delete();

await transferHostWhenLeave(
room.id,
p.id
);

console.log(
"Kick offline:",
p.id
);

}

}


await sendRoom(room.id);

}


}

setInterval(()=>{

checkOffline();

},30000);
