import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { db } from "./firebase.js";

import {
  broadcast,
  sendPlayer,
  createWebSocketServer
} from "./websocket.js";

import {
  createRoomUtils
} from "./roomUtils.js";

import {
  createRoomRouter
} from "./room.js";

import {
  createGameManager
} from "./game.js";


// =====================
// ENV
// =====================

dotenv.config();


// =====================
// EXPRESS
// =====================

const app = express();

const PORT = process.env.PORT || 8080;


app.use(cors());

app.use(express.json());


// =====================
// TẠO MODULE
// =====================


// Logic phòng

const roomUtils =
  createRoomUtils(
    broadcast,
    db
  );


// Logic game

const gameManager =
  createGameManager(
    db,
    sendPlayer,
    broadcast
  );


// API phòng

const roomRouter =
  createRoomRouter(
    db,
    broadcast,
    roomUtils,
    gameManager
  );



// =====================
// ROUTES
// =====================

app.get("/", (_, res)=>{

  res.json({

    status:"online",

    game:"Werewolf Online Server",

    version:"V2"

  });

});


app.use(
  "/room",
  roomRouter
);



// =====================
// START SERVER
// =====================

const server =
  app.listen(
    PORT,
    ()=>{

      console.log(
        "🚀 Server running on port",
        PORT
      );

    }
  );



// =====================
// WEBSOCKET
// =====================

createWebSocketServer(
  server,
  {
    sendRoom: roomUtils.sendRoom,
    gameManager
  }
);



// =====================
// CRON
// =====================

setInterval(

  roomUtils.autoDeleteEmptyRooms,

  60_000

);


setInterval(

  roomUtils.checkOffline,

  30_000

);
