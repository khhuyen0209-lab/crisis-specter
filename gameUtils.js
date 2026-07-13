// Các hàm xử lý logic game


function shuffle(array) {

  return array.sort(() => Math.random() - 0.5);

}



// Chia vai trò

export function assignRoles(players) {

  const count = players.length;


  let wolves = 1;

  if(count >= 5) wolves = 2;
  if(count >= 8) wolves = 3;
  if(count >= 12) wolves = 4;


  const roles = [];


  for(let i = 0; i < wolves; i++){
    roles.push("wolf");
  }


  if(count >= 3){
    roles.push("seer");
    roles.push("protect");
  }


  while(roles.length < count){
    roles.push("villager");
  }


  shuffle(roles);



  return players.map((p,i)=>({

    uid:p.uid,

    name:p.name,

    role:roles[i],

    team:
      roles[i] === "wolf"
      ? "wolf"
      : "human",

    alive:true

  }));

}



// Kiểm tra thắng

export function checkWinner(players){


  const alive =
    players.filter(p=>p.alive);



  const wolves =
    alive.filter(p=>p.team==="wolf").length;



  const humans =
    alive.filter(p=>p.team==="human").length;



  if(wolves === 0){

    return "human";

  }



  if(wolves >= humans){

    return "wolf";

  }



  return null;

}
