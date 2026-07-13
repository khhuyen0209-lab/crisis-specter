// Lưu trạng thái các ván đang chạy trong RAM

export const games = new Map();


export function createGame(room, players) {

  const game = {
    room,

    phase: "morning",

    day: 1,

    timer: 150,

    players,

    actions: {
      wolf: {},
      seer: null,
      protect: null,
      votes: {}
    },

    winner: null
  };


  games.set(room, game);

  return game;
}


export function getGame(room) {
  return games.get(room);
}


export function deleteGame(room) {
  games.delete(room);
}
