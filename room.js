import express from "express";

export function createRoomRouter(
  db,
  broadcast,
  utils,
  gameManager,
  playerRooms
){

const router = express.Router();

const {
  randomRoom,
  sendRoom,
  transferHostWhenLeave
}=utils;


// =====================
// TẠO PHÒNG
// =====================

router.post("/create",async(req,res)=>{

try{

const {
uid,
name,
maxPlayers,
locked
}=req.body;


let room;

while(true){

room=randomRoom();

if(!(await db.collection("rooms").doc(room).get()).exists)
break;

}



const ref=db.collection("rooms").doc(room);


await ref.set({

host:uid,

maxPlayers:maxPlayers||8,

locked:locked||false,

status:"waiting",

empty:false,

createdAt:Date.now(),

lastActive:Date.now()

});



await ref.collection("players").doc(uid).set({

name:name||"Player",

avatar:"👑",

seat:0,

ready:true,

lastSeen:Date.now()

});



playerRooms.set(uid,room);


await sendRoom(room);


res.json({

ok:true,

room

});


}catch(e){

res.status(500).json({

ok:false,

error:e.message

});

}

});




// =====================
// VÀO PHÒNG
// =====================

router.post("/join",async(req,res)=>{

try{

const {
uid,
room,
name
}=req.body;



// kiểm tra đang ở phòng khác

const oldRoom=playerRooms.get(uid);


if(oldRoom && oldRoom!==room){

return res.json({

ok:false,

error:"Bạn đang ở phòng khác"

});

}



const ref=db.collection("rooms").doc(room);


const snap=await ref.get();


if(!snap.exists)

return res.json({

ok:false,

error:"Không tồn tại phòng"

});



const data=snap.data();



if(data.status!=="waiting")

return res.json({

ok:false,

error:"Game đã bắt đầu"

});



if(data.locked)

return res.json({

ok:false,

error:"Phòng khóa"

});



const players=
await ref.collection("players").get();



if(players.size>=data.maxPlayers)

return res.json({

ok:false,

error:"Phòng đầy"

});




const used=
players.docs.map(
p=>p.data().seat
);



let seat=0;

while(used.includes(seat))
seat++;




await ref.collection("players")
.doc(uid)
.set({

name:name||("Player "+(seat+1)),

avatar:"🙂",

seat,

ready:false,

lastSeen:Date.now()

});



const roomData=(await ref.get()).data();



if(!roomData.host){

await ref.update({

host:uid,

empty:false,

lastActive:Date.now()

});

}else{

await ref.update({

lastActive:Date.now()

});

}



playerRooms.set(uid,room);



await sendRoom(room);



res.json({

ok:true

});



}catch(e){

res.status(500).json({

ok:false,

error:e.message

});

}

});




// =====================
// READY
// =====================

router.post("/ready",async(req,res)=>{

try{

const {
uid,
room
}=req.body;


const ref=db.collection("rooms")
.doc(room)
.collection("players")
.doc(uid);



const snap=await ref.get();


if(!snap.exists)

return res.json({

ok:false,

error:"Không tìm thấy người chơi"

});



await ref.update({

ready:!snap.data().ready,

lastSeen:Date.now()

});



await sendRoom(room);



res.json({

ok:true

});


}catch(e){

res.status(500).json({

ok:false,

error:e.message

});

}

});




// =====================
// RỜI PHÒNG
// =====================

router.post("/leave",async(req,res)=>{

try{

const {
uid,
room
}=req.body;


const ref=db.collection("rooms").doc(room);



await ref.collection("players")
.doc(uid)
.delete();



if(playerRooms)

playerRooms.delete(uid);



await transferHostWhenLeave(
room,
uid
);



if((await ref.get()).exists){

await ref.update({

lastActive:Date.now()

});


await sendRoom(room);

}



res.json({

ok:true

});



}catch(e){

res.status(500).json({

ok:false,

error:e.message

});

}

});




// =====================
// ĐÁ NGƯỜI
// =====================

router.post("/kick",async(req,res)=>{

try{

const {
host,
target,
room
}=req.body;



const ref=db.collection("rooms").doc(room);


const snap=await ref.get();



if(!snap.exists)

return res.json({

ok:false,

error:"Phòng không tồn tại"

});



if(snap.data().host!==host)

return res.json({

ok:false,

error:"Không phải chủ phòng"

});



if(host===target)

return res.json({

ok:false,

error:"Không thể đá bản thân"

});



await ref.collection("players")
.doc(target)
.delete();



if(playerRooms)

playerRooms.delete(target);



await ref.update({

lastActive:Date.now()

});



await sendRoom(room);



res.json({

ok:true

});


}catch(e){

res.status(500).json({

ok:false,

error:e.message

});

}

});

  // =====================
// CHUYỂN CHỦ
// =====================

router.post("/transfer",async(req,res)=>{

try{

const {
host,
target,
room
}=req.body;


const ref=db.collection("rooms").doc(room);

const snap=await ref.get();


if(!snap.exists)

return res.json({

ok:false,

error:"Phòng không tồn tại"

});



if(snap.data().host!==host)

return res.json({

ok:false,

error:"Không phải chủ phòng"

});



const player=
await ref.collection("players")
.doc(target)
.get();



if(!player.exists)

return res.json({

ok:false,

error:"Người chơi không tồn tại"

});



await ref.update({

host:target,

lastActive:Date.now()

});



await sendRoom(room);



res.json({

ok:true

});



}catch(e){

res.status(500).json({

ok:false,

error:e.message

});

}

});





// =====================
// VÀO NHANH + RECONNECT
// =====================

router.get("/quick",async(req,res)=>{

try{


const uid=req.query.uid;


if(!uid)

return res.json({

room:null

});



// 1. kiểm tra cache trước

let oldRoom=
playerRooms.get(uid);



if(oldRoom){


const oldRef=
db.collection("rooms").doc(oldRoom);



const oldSnap=
await oldRef.get();



if(oldSnap.exists){


const status=
oldSnap.data().status;



// đang chơi -> quay lại game

if(status==="playing"){

return res.json({

room:oldRoom,

sync:true,

location:"game"

});

}



// phòng chờ

if(status==="waiting"){

const roomData = await oldRef.get();

const players = await oldRef
.collection("players")
.get();


return res.json({

room:oldRoom,

sync:true,

location:"room",

data:{
    room:oldRoom,
    ...roomData.data(),
    players:players.docs.map(p=>({
        id:p.id,
        ...p.data()
    }))
}

});

}



playerRooms.delete(uid);


}



// 2. tìm trong firebase nếu cache mất

const rooms=
await db.collection("rooms")
.where("status","==","waiting")
.get();



for(const r of rooms.docs){


if(r.data().locked)
continue;



const players=
await r.ref.collection("players").get();



if(players.size<r.data().maxPlayers){


return res.json({

room:r.id,

sync:false

});


}

}



res.json({

room:null

});


}catch(e){

res.status(500).json({

error:e.message

});

}

});





// =====================
// BẮT ĐẦU GAME
// =====================

router.post("/start",async(req,res)=>{

try{


const {
uid,
room
}=req.body;



const ref=
db.collection("rooms").doc(room);



const snap=
await ref.get();



if(!snap.exists)

return res.json({

ok:false,

error:"Phòng không tồn tại"

});



if(snap.data().host!==uid)

return res.json({

ok:false,

error:"Chỉ chủ phòng được bắt đầu"

});



const players=
await ref.collection("players").get();



if(players.size<3)

return res.json({

ok:false,

error:"Cần ít nhất 3 người"

});





await ref.update({

status:"preparing",

lastActive:Date.now()

});



broadcast(room,{

type:"game",

phase:"preparing",

message:"🐺 Đang chuẩn bị..."

});





setTimeout(async()=>{


await gameManager.startGame(room);


},3000);




res.json({

ok:true

});



}catch(e){

res.status(500).json({

ok:false,

error:e.message

});

}

});






// =====================
// CHAT HISTORY
// =====================

router.get("/:id/chat",async(req,res)=>{

try{


const list=
await db.collection("rooms")
.doc(req.params.id)
.collection("chat")
.orderBy("time","asc")
.limit(100)
.get();



res.json(

list.docs.map(
x=>x.data()
)

);



}catch(e){

res.status(500).json({

error:e.message

});

}

});





return router;

}
