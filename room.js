import { db } from "./firebase.js";


let broadcast = null;


export function setBroadcast(fn){

    broadcast = fn;

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



    if(broadcast){

        broadcast(room,{

            type:"room",

            room,


            host:data.host,


            locked:data.locked,

            maxPlayers:data.maxPlayers,

            status:data.status,

            lastActive:data.lastActive,


            players:list


        });

    }

}




// =====================
// TRANSFER HOST
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



if(players.empty){


await roomRef.update({

    host:null,

    empty:true,

    lastActive:Date.now()

});


console.log(
"Room empty:",
room
);


return;

}




const newHost =
players.docs[0].id;



await roomRef.update({

    host:newHost,

    empty:false,

    lastActive:Date.now()

});



console.log(
"New host:",
newHost
);



await sendRoom(room);


}




// =====================
// ROUTES
// =====================


export function roomRoutes(app){


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




// phòng không có chủ

const newSnap =
await ref.get();


const newData =
newSnap.data();



if(!newData.host){


await ref.update({

host:uid,

empty:false,

lastActive:Date.now()

});


}
else{


await ref.update({

lastActive:Date.now()

});


}




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



await transferHostWhenLeave(
room,
uid
);



const check =
await roomRef.get();



if(check.exists){


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

app.post(
"/room/kick",
async(req,res)=>{


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

app.post(
"/room/transfer",
async(req,res)=>{


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

  }
