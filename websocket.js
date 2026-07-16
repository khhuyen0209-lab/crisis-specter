import { WebSocketServer } from "ws";
import { db } from "./firebase.js";


/*
=================================
 SESSION MANAGER
=================================
*/

export const clients = new Map();



function send(ws,data){

  if(
    ws &&
    ws.readyState === 1
  ){

    ws.send(
      JSON.stringify(data)
    );

  }

}




export function sendPlayer(uid,data){

  const ws = clients.get(uid);

  if(ws){

    send(ws,data);

  }

}




export function broadcast(room,data){

  for(const ws of clients.values()){

    if(
      ws.room === room &&
      ws.readyState === 1
    ){

      send(ws,data);

    }

  }

}




function changeState(ws,location,room=null){

  ws.location = location;
  ws.room = room;

}





/*
=================================
 TÌM PHÒNG CỦA NGƯỜI CHƠI
=================================
*/

async function findPlayerRoom(uid){

  const rooms =
    await db.collection("rooms").get();


  for(const r of rooms.docs){

    const p =
      await r.ref
      .collection("players")
      .doc(uid)
      .get();


    if(p.exists){

      return r.id;

    }

  }


  return null;

}





/*
=================================
 CREATE WS SERVER
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
"🐺 WebSocket Server Ready"
);



wss.on(
"connection",
(ws)=>{


console.log(
"🔌 Connected"
);



/*
 SESSION STATE
*/

ws.uid=null;

ws.room=null;

ws.location="lobby";





send(ws,{

 type:"connected",

 message:"WebSocket online"

});





ws.on(
"message",
async(raw)=>{


try{


const data =
JSON.parse(raw);





/*
====================
 AUTH
====================
*/

if(data.type==="auth"){


ws.uid=data.uid;


clients.set(
ws.uid,
ws
);



console.log(
"✅ AUTH",
ws.uid
);



return;

}






/*
====================
 JOIN ROOM
====================
*/


if(data.type==="join"){


if(!ws.uid)
return;



const room=data.room;



changeState(
ws,
"room",
room
);



send(ws,{

type:"joined",

room

});



await sendRoom(room);



return;

}







/*
====================
 HEARTBEAT
====================
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
====================
 CHAT
====================
*/


if(data.type==="chat"){


if(
!ws.room
)
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
====================
 GAME ACTION
====================
*/


if(data.type==="action"){


if(
ws.location!=="game"
&&
ws.room
)
{


gameManager.action(

ws.room,

ws.uid,

data.action,

data.target

);


}



return;

}








/*
====================
 SYNC
====================
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





ws.room=room;



const game =
gameManager.getGame(room);



if(game){


changeState(
ws,
"game",
room
);



send(ws,{

type:"game",

phase:game.phase,

day:game.day,

players:
game.players.map(p=>({

id:p.id,

name:p.name,

avatar:p.avatar,

alive:p.alive

}))

});


}else{


changeState(
ws,
"room",
room
);


await sendRoom(room);


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


if(ws.uid){

clients.delete(
ws.uid
);

}



console.log(
"🔌 Disconnected",
ws.uid
);



});






ws.on(
"error",
(err)=>{


console.log(
"WS ERROR",
err.message
);


});


});



return wss;


}
