import { db } from "./firebase.js";

import {
  createGame
} from "./gameState.js";

import {
  assignRoles
} from "./gameUtils.js";



export function createGameManager(
  broadcast,
  sendPlayer
){



async function start(room){


  try{


    const roomRef =
      db.collection("rooms")
      .doc(room);



    const snap =
      await roomRef.get();



    if(!snap.exists){

      throw new Error(
        "Room không tồn tại"
      );

    }



    // Chuẩn bị

    await roomRef.update({

      status:"preparing"

    });



    broadcast(room,{

      type:"game_prepare",

      message:
      "Đang chuẩn bị trận đấu..."

    });



    // Lấy player

    const playersSnap =
      await roomRef
      .collection("players")
      .get();



    if(playersSnap.size < 3){


      await roomRef.update({

        status:"waiting"

      });



      broadcast(room,{

        type:"game_error",

        message:
        "Không đủ người chơi"

      });


      return;

    }



    const players =
      playersSnap.docs.map(p=>({

        uid:p.id,

        ...p.data()

      }));




    // Chia vai

    const roles =
      assignRoles(players);




    const game =
      createGame(
        room,
        roles
      );




    // Gửi role riêng

    roles.forEach(player=>{


      sendPlayer(

        player.uid,

        {
          type:"role",
          role:player.role
        }

      );


    });




    // Chuyển sang chơi

    await roomRef.update({

      status:"playing",

      startedAt:
      Date.now()

    });




    broadcast(room,{

      type:"game_start",

      phase:"morning",

      day:game.day,

      timer:game.timer

    });



    console.log(
      "🐺 Game started:",
      room
    );



  }catch(e){


    console.log(
      "Start game error:",
      e.message
    );


  }


}




return {

  start

};


}
