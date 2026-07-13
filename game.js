// game.js

export function createGameManager(db, sendPlayer, broadcast) {


  const games = new Map();



  // =========================
  // BẮT ĐẦU GAME
  // =========================

  async function startGame(room){


    const ref =
      db.collection("rooms").doc(room);



    const playersSnap =
      await ref.collection("players").get();



    const players =
      playersSnap.docs.map(p => ({

        id:p.id,

        ...p.data(),

        alive:true

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

      votes:{},

      nightAction:{}

    };



    games.set(room,game);



    await ref.update({

      status:"playing",

      gameStarted:Date.now()

    });



    // gửi vai trò riêng

    players.forEach(p=>{

      sendPlayer(p.id,{

        type:"role",

        role:p.role

      });


    });



    broadcast(room,{

      type:"game",

      phase:"night",

      day:1,

      message:"Đêm đầu tiên bắt đầu"

    });



    startNight(room);

  }




  // =========================
  // CHIA ROLE
  // =========================

  function createRoles(count){


    let wolf = 1;


    if(count >= 5)
      wolf = 2;


    if(count >= 8)
      wolf = 3;


    if(count >= 12)
      wolf = 4;



    const roles=[];



    for(let i=0;i<wolf;i++)
      roles.push("wolf");



    if(count >= 3){

      roles.push("seer");

      roles.push("guard");

    }



    while(roles.length < count){

      roles.push("villager");

    }



    return shuffle(roles);

  }




  function shuffle(arr){

    return arr.sort(()=>Math.random()-0.5);

  }




  // =========================
  // ĐÊM
  // =========================

  function startNight(room){


    const game =
      games.get(room);


    if(!game)
      return;



    game.phase="night";


    game.nightAction={};



    broadcast(room,{

      type:"phase",

      phase:"night",

      time:150

    });



    setTimeout(()=>{

      endNight(room);

    },150000);


  }




  // =========================
  // KẾT THÚC ĐÊM
  // =========================

  function endNight(room){


    const game =
      games.get(room);



    if(!game)
      return;



    const action =
      game.nightAction;



    const target =
      action.wolf;



    if(target){


      const protect =
        action.guard;



      if(protect !== target){


        killPlayer(
          room,
          target
        );


      }


    }



    checkWin(room);



    if(games.has(room))

      startMorning(room);


  }




  // =========================
  // SÁNG
  // =========================

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

    },120000);


  }




  // =========================
  // VOTE
  // =========================

  function startVote(room){


    const game =
      games.get(room);



    if(!game)
      return;



    game.phase="vote";

    game.votes={};



    broadcast(room,{

      type:"vote",

      time:90

    });



    setTimeout(()=>{

      endVote(room);

    },90000);


  }




  function vote(room,uid,target){


    const game =
      games.get(room);


    if(!game)
      return;



    const player =
      game.players.find(
        p=>p.id===uid
      );



    if(!player || !player.alive)
      return;



    game.votes[uid]=target;

  }




  function endVote(room){


    const game =
      games.get(room);



    if(!game)
      return;



    const count={};



    Object.values(game.votes)
    .forEach(id=>{

      count[id]=(count[id]||0)+1;

    });



    let dead=null;

    let max=0;



    for(const id in count){

      if(count[id]>max){

        max=count[id];

        dead=id;

      }

    }



    // hòa vote

    const same =
      Object.values(count)
      .filter(x=>x===max)
      .length;



    if(same>1)

      dead=null;



    if(dead)

      killPlayer(room,dead);



    checkWin(room);



    if(games.has(room))

      startNight(room);


  }




  // =========================
  // GIẾT NGƯỜI
  // =========================

  function killPlayer(room,uid){


    const game =
      games.get(room);



    const p =
      game.players.find(
        x=>x.id===uid
      );



    if(!p)
      return;



    p.alive=false;



    broadcast(room,{

      type:"dead",

      player:uid,

      faction:
        p.role==="wolf"
        ?"wolf"
        :"villager"

    });


  }




  // =========================
  // KIỂM TRA THẮNG
  // =========================

  function checkWin(room){


    const game =
      games.get(room);



    if(!game)
      return;



    const alive =
      game.players.filter(
        p=>p.alive
      );



    const wolf =
      alive.filter(
        p=>p.role==="wolf"
      ).length;



    const human =
      alive.length-wolf;



    if(wolf===0){

      endGame(room,"villager");

      return true;

    }



    if(wolf>=human){

      endGame(room,"wolf");

      return true;

    }



    return false;

  }




  function endGame(room,winner){


    broadcast(room,{

      type:"game_end",

      winner

    });



    games.delete(room);

  }



  return {

    startGame,

    vote,

    checkWin

  };

}
