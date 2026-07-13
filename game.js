import { sendPlayer, broadcast } from "./websocket.js";
import { db } from "./firebase.js";


const games = new Map();



// ===============================
// TẠO GAME
// ===============================

export async function startGame(room){


    const ref =
        db.collection("rooms").doc(room);



    const playersSnap =
        await ref.collection("players").get();



    const players =
        playersSnap.docs.map(p=>({

            id:p.id,

            ...p.data()

        }));



    if(players.length < 3)
        return;



    const roles =
        createRoles(players.length);



    players.forEach((p,i)=>{

        p.role = roles[i];

    });



    const game = {

        room,

        players,

        phase:"night",

        day:1,

        night:1,

        startedAt:Date.now()

    };



    games.set(room,game);



    // lưu trạng thái

    await ref.update({

        status:"playing",

        gameStarted:Date.now()

    });



    // gửi role riêng

    players.forEach(p=>{


        sendPlayer(p.id,{

            type:"role",

            role:p.role

        });


    });



    // gửi thông tin chung

    broadcast(room,{

        type:"game",

        phase:"night",

        day:1,

        message:"Đêm đầu tiên bắt đầu"

    });



    startNight(room);


}



// ===============================
// CHIA ROLE
// ===============================

function createRoles(count){


    let wolves = 1;


    if(count >= 5)
        wolves = 2;


    if(count >= 8)
        wolves = 3;


    if(count >= 12)
        wolves = 4;



    const roles=[];



    for(let i=0;i<wolves;i++){

        roles.push("wolf");

    }



    if(count >= 3){

        roles.push("seer");

        roles.push("guard");

    }



    while(roles.length < count){

        roles.push("villager");

    }



    return shuffle(roles);

}



// random

function shuffle(arr){

    return arr.sort(()=>Math.random()-0.5);

}



// ===============================
// BAN ĐÊM
// ===============================

function startNight(room){


    const game =
        games.get(room);


    if(!game)
        return;



    game.phase="night";



    broadcast(room,{

        type:"phase",

        phase:"night",

        time:150

    });



    // 2 phút 30 giây

    setTimeout(()=>{

        startMorning(room);

    },150000);



}



// ===============================
// BUỔI SÁNG
// ===============================

function startMorning(room){


    const game =
        games.get(room);


    if(!game)
        return;



    game.phase="morning";



    broadcast(room,{

        type:"phase",

        phase:"morning",

        time:120

    });



    setTimeout(()=>{

        startVote(room);

    },90000);


}



// ===============================
// VOTE
// ===============================

function startVote(room){


    const game =
        games.get(room);


    if(!game)
        return;



    game.phase="vote";

    game.votes={};



    broadcast(room,{

        type:"vote",

        time:30,

        message:"Bắt đầu bỏ phiếu"

    });



    setTimeout(()=>{

        endVote(room);

    },30000);


}



// ===============================
// KẾT QUẢ VOTE
// ===============================

function endVote(room){


    const game =
        games.get(room);


    if(!game)
        return;



    const votes =
        game.votes;



    let result={};


    Object.values(votes)
    .forEach(id=>{

        result[id]=(result[id]||0)+1;

    });



    let dead=null;


    let max=0;


    for(const id in result){

        if(result[id]>max){

            max=result[id];

            dead=id;

        }

    }



    // hòa

    const same =
        Object.values(result)
        .filter(x=>x===max)
        .length;



    if(same>1){

        dead=null;

    }



    if(dead){

        const p =
            game.players.find(x=>x.id===dead);


        p.alive=false;



        broadcast(room,{

            type:"dead",

            player:dead,

            faction:getFaction(p.role)

        });

    }



    checkWin(room);



    if(games.has(room))

        startNight(room);


}



// ===============================
// KIỂM TRA THẮNG
// ===============================

function checkWin(room){


    const game =
        games.get(room);


    const alive =
        game.players.filter(p=>p.alive!==false);



    const wolves =
        alive.filter(p=>p.role==="wolf").length;



    const humans =
        alive.length-wolves;



    if(wolves===0){

        endGame(room,"villager");

        return true;

    }



    if(wolves>=humans){

        endGame(room,"wolf");

        return true;

    }


    return false;

}



function endGame(room,winner){


    broadcast(room,{

        type:"end",

        winner

    });



    games.delete(room);

}



function getFaction(role){

    return role==="wolf"
        ? "wolf"
        : "villager";

          }
