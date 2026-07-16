import { WebSocketServer } from "ws";
import { db } from "./firebase.js";


/*
=================================
 SESSION
=================================
*/

export const clients = new Map();
export const playerRooms = new Map();


/*
=================================
 SEND
=================================
*/

export function send(ws,data){

  try{

    if(
      ws &&
      ws.readyState === 1
    ){

      ws.send(
        JSON.stringify(data)
      );

    }

  }catch(e){

    console.log(
      "SEND ERROR:",
      e.message
    );

  }

}







/*
=================================
 SEND PLAYER
=================================
*/

export function sendPlayer(uid,data){

  const ws =
    clients.get(uid);


  if(ws){

    send(ws,data);

  }

}







/*
=================================
 BROADCAST
=================================
*/

export function broadcast(room,data){

  for(
    const ws of clients.values()
  ){

    if(
      ws.room === room &&
      ws.readyState === 1
    ){

      send(ws,data);

    }

  }

}







/*
=================================
 STATE
=================================
*/

export function changeState(
ws,
location,
room=null
){

  ws.location = location;

  ws.room = room;


  if(
    ws.uid &&
    room
  ){

    playerRooms.set(
      ws.uid,
      room
    );

  }


}






export function setRoomState(
room,
state
){

  for(
    const ws of clients.values()
  ){

    if(
      ws.room === room
    ){

      ws.location = state;

    }

  }

}








/*
=================================
 FIND ROOM
=================================
*/

async function findPlayerRoom(uid){


  // RAM trước

  if(
    playerRooms.has(uid)
  ){

    return playerRooms.get(uid);

  }




  // fallback Firebase

  try{


    const rooms =
      await db
      .collection("rooms")
      .get();



    for(
      const r of rooms.docs
    ){


      const p =
        await r.ref
        .collection("players")
        .doc(uid)
        .get();



      if(p.exists){


        playerRooms.set(
          uid,
          r.id
        );


        return r.id;

      }

    }


  }catch(e){

    console.log(
      "Find room error:",
      e.message
    );

  }



  return null;

}









/*
=================================
 CREATE SERVER
=================================
*/

export function createWebSocketServer(
server,
{
 sendRoom,
 gameManager
}
){


const wss =
new WebSocketServer({
 server
});




console.log(
"🐺 WebSocket Ready"
);





wss.on(
"connection",
(ws)=>{


ws.uid=null;

ws.room=null;

ws.location="lobby";


ws.lastMessage=0;





send(ws,{

type:"connected",

message:"online"

});








ws.on(
"message",
async(raw)=>{


try{


// rate limit

const now =
Date.now();


if(
now - ws.lastMessage < 50
){

return;

}


ws.lastMessage = now;



const data =
JSON.parse(raw);








/*
==================
AUTH
==================
*/

if(data.type==="auth"){


const old =
clients.get(
data.uid
);



if(
old &&
old!==ws
){

old.close();

}



ws.uid =
data.uid;



clients.set(
ws.uid,
ws
);



return;

}









/*
==================
JOIN
==================
*/

if(data.type==="join"){


if(!ws.uid)
return;



changeState(
ws,
"room",
data.room
);



send(ws,{

type:"joined",

room:data.room

});



try{

await sendRoom(
data.room
);

}catch(e){

console.log(
"sendRoom error",
e.message
);

}



return;

}










/*
==================
HEARTBEAT
==================
*/

if(data.type==="heartbeat"){


if(
!ws.uid ||
!ws.room
)
return;



const ref =
db
.collection("rooms")
.doc(ws.room)
.collection("players")
.doc(ws.uid);



if(
(await ref.get()).exists
){

await ref.update({

lastSeen:Date.now()

});

}


return;

}










/*
==================
LEAVE
==================
*/

if(data.type==="leave"){


const room =
ws.room;



if(
room &&
ws.uid
){


await db
.collection("rooms")
.doc(room)
.collection("players")
.doc(ws.uid)
.delete();



playerRooms.delete(
ws.uid
);



try{

await sendRoom(room);

}catch{}

}



changeState(
ws,
"lobby"
);



return;

}









/*
==================
CHAT
==================
*/

if(data.type==="chat"){


if(!ws.room)
return;



broadcast(
ws.room,
{

type:"chat",

name:ws.uid,

text:data.text

});



return;

}









/*
==================
ACTION
==================
*/

if(data.type==="action"){


if(
ws.location!=="game"
)
return;



gameManager.action(

ws.room,

ws.uid,

data.action,

data.target

);



return;

}










/*
==================
SYNC
==================
*/

if(data.type==="sync"){


if(!ws.uid)
return;



const room =
await findPlayerRoom(
ws.uid
);




if(!room){


changeState(
ws,
"lobby"
);



send(ws,{

type:"sync",

location:"lobby"

});


return;

}




const game =
gameManager.getGame(
room
);



if(game){


changeState(
ws,
"game",
room
);



const me =
game.players.find(
p=>p.id===ws.uid
);



send(ws,{

type:"game_sync",

phase:game.phase,

day:game.day,

players:
game.players.map(p=>({

id:p.id,

name:p.name,

avatar:p.avatar,

seat:p.seat,

alive:p.alive

})),

role:
me?.role || null

});



}else{


changeState(
ws,
"room",
room
);



try{

await sendRoom(room);

}catch{}

}



return;

}

if(data.type==="syncGame"){


try{


await gameManager.syncGame(

data.room,

data.uid,

ws

);


}catch(e){

console.log(
"sync game error:",
e.message
);

}


return;

   }




}catch(e){

console.log(
"WS ERROR:",
e.message
);

}


});








ws.on(
"close",
()=>{


if(
ws.uid &&
clients.get(ws.uid)===ws
){

clients.delete(
ws.uid
);

}



});




ws.on(
"error",
e=>{

console.log(
"WS ERROR:",
e.message
);

});


});



return wss;

}
