export function createGameManager(
  db,
  sendPlayer,
  broadcast
){

  const games = new Map();



  function getPublicPlayers(game){

    return game.players.map(p=>({

      id:p.id,

      name:p.name,

      avatar:p.avatar,

      seat:p.seat,

      alive:p.alive

    }));

  }





  async function startGame(room){


    const ref =
      db.collection("rooms").doc(room);



    const snap =
      await ref.collection("players").get();



    const players =
      snap.docs.map(p=>({

        id:p.id,

        ...p.data(),

        alive:true

      }));



    if(players.length < 1)
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
  nightAction:{
    wolfVotes:{},
    guard:null,
    seerUsed:null,
    guardUsed:null
  }

};



    games.set(room,game);



    await ref.update({
      
  status:"playing",
      
  host:null,
      
  gameStarted:Date.now()
      
});




    // gửi role riêng

    players.forEach(p=>{

  // Gửi vai trò
  sendPlayer(p.id,{
    type:"role",
    role:p.role
  });

  // Gửi kỹ năng
  let actions = [];

  if(p.role==="wolf"){
    actions.push({
      id:"kill",
      name:"🐺 Cắn"
    });
  }

  if(p.role==="seer"){
    actions.push({
      id:"see",
      name:"🔮 Soi"
    });
  }

  if(p.role==="guard"){
    actions.push({
      id:"guard",
      name:"🛡️ Bảo vệ"
    });
  }

  sendPlayer(p.id,{
    type:"actions",
    actions
  });

});





    broadcast(room,{

      type:"game",

      phase:"night",

      day:1,

      message:"🌙 Đêm đầu tiên bắt đầu",

      players:getPublicPlayers(game)

    });



    startNight(room);


  }






  function createRoles(count){


    let wolves = 1;



    if(count>=5)
      wolves=2;


    if(count>=8)
      wolves=3;


    if(count>=12)
      wolves=4;



    let roles=[];



    for(let i=0;i<wolves;i++)

      roles.push("wolf");



    if(count>=3){

      roles.push("seer");

      roles.push("guard");

    }



    while(roles.length<count){

      roles.push("villager");

    }



    return shuffle(roles);

  }





  function shuffle(arr){

    return arr
    .sort(
      ()=>Math.random()-0.5
    );

  }





  function startNight(room){


    const game =
      games.get(room);


    if(!game)
      return;



    game.phase="night";

    game.nightAction = {
    wolfVotes:{},
    guard:null,
    guardUsed:null,
    seerUsed:null
};


    broadcast(room,{

      type:"game",

      phase:"night",

      time:90,

      players:getPublicPlayers(game)

    });



    setTimeout(()=>{

      endNight(room);

    },90000);


  }







  function endNight(room){

  const game = games.get(room);
  if(!game) return;

  // Đếm phiếu của sói
  const votes = {};

  Object.values(game.nightAction.wolfVotes).forEach(id=>{

    votes[id] = (votes[id] || 0) + 1;

  });

  let target = null;
  let max = 0;

  for(const id in votes){

    if(votes[id] > max){

      max = votes[id];
      target = id;

    }

  }

  // Nếu hòa phiếu thì không ai chết
  const same =
    Object.values(votes)
      .filter(v=>v===max)
      .length;

  if(same > 1){
    target = null;
  }

  // Bảo vệ
  if(
    target &&
    target !== game.nightAction.guard
  ){
    killPlayer(room,target);
  }

  if(checkWin(room))
    return;

  startMorning(room);

}






  function startMorning(room){


    const game =
      games.get(room);


    if(!game)
      return;



    game.phase="morning";



    broadcast(room,{

      type:"game",

      phase:"morning",

      time:120,

      players:getPublicPlayers(game)

    });



    setTimeout(()=>{

      startVote(room);

    },120000);


  }








  function startVote(room){


    const game =
      games.get(room);


    if(!game)
      return;



    game.phase="vote";

    game.votes={};



    broadcast(room,{

      type:"game",

      phase:"vote",

      time:30,

      players:getPublicPlayers(game)

    });



    setTimeout(()=>{

      endVote(room);

    },30000);


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



    if(
      !player ||
      !player.alive
    )
      return;



    game.votes[uid]=target;


  }








  function endVote(room){


    const game =
      games.get(room);


    if(!game)
      return;



    const result={};



    Object.values(game.votes)
    .forEach(id=>{

      result[id] =
      (result[id]||0)+1;

    });



    let max=0;

    let dead=null;



    for(const id in result){


      if(result[id]>max){

        max=result[id];

        dead=id;

      }

    }




    const same =
      Object.values(result)
      .filter(
        x=>x===max
      )
      .length;



    if(same>1)

      dead=null;



    if(dead)

      killPlayer(room,dead);




    if(checkWin(room))
  return;


startAfternoon(room);


  }



function startAfternoon(room){

  const game =
    games.get(room);


  if(!game)
    return;


  game.phase="afternoon";


  broadcast(room,{

    type:"game",

    phase:"afternoon",

    time:60,

    players:getPublicPlayers(game)

  });


  setTimeout(()=>{

    startNight(room);

  },60000);

}




  function killPlayer(room,uid){


    const game =
      games.get(room);



    if(!game)
      return;



    const player =
      game.players.find(
        p=>p.id===uid
      );



    if(!player)
      return;



    player.alive=false;



    broadcast(room,{

      type:"dead",

      player:uid,

      faction:
        player.role==="wolf"
        ?
        "wolf"
        :
        "villager",

      players:getPublicPlayers(game)

    });


  }








  function checkWin(room){


    const game =
      games.get(room);



    if(!game)
      return false;



    const alive =
      game.players.filter(
        p=>p.alive
      );



    const wolves =
      alive.filter(
        p=>p.role==="wolf"
      ).length;



    const humans =
      alive.length-wolves;



    if(wolves===0){

      endGame(
        room,
        "villager"
      );

      return true;

    }



    if(wolves>=humans){

      endGame(
        room,
        "wolf"
      );

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



function action(room, uid, action, target){

  const game = games.get(room);
  if(!game) return;

  const player = game.players.find(p => p.id === uid);
  if(!player || !player.alive) return;

  switch(action){

    // 🐺 Sói bỏ phiếu cắn
    case "kill":

      if(player.role !== "wolf") return;

      game.nightAction.wolfVotes[uid] = target;

      sendPlayer(uid,{
        type:"info",
        text:"🐺 Đã bỏ phiếu."
      });

      break;

    // 🔮 Tiên tri
    case "see":

  if(player.role !== "seer") return;

  if(game.nightAction.seerUsed === uid){
    sendPlayer(uid,{
      type:"info",
      text:"❌ Bạn đã dùng kỹ năng trong đêm này."
    });
    return;
  }

  game.nightAction.seerUsed = uid;

  const targetPlayer =
    game.players.find(p => p.id === target);

  if(!targetPlayer) return;

  sendPlayer(uid,{
    type:"see_result",
    target,
    faction:
      targetPlayer.role==="wolf"
        ? "wolf"
        : "villager"
  });

  break;

    // 🛡️ Bảo vệ
    case "guard":

  if(player.role !== "guard") return;

  if(game.nightAction.guardUsed === uid){
    sendPlayer(uid,{
      type:"info",
      text:"❌ Bạn đã dùng kỹ năng trong đêm này."
    });
    return;
  }

  game.nightAction.guardUsed = uid;
  game.nightAction.guard = target;

  sendPlayer(uid,{
    type:"info",
    text:"🛡️ Đã bảo vệ."
  });

  break;

  }

}

function getGamesCount(){

  return games.size;

}


return {

    startGame,

    vote,

    checkWin,
  
    action,

    getGamesCount

};

      }
