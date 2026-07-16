import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { db } from "./firebase.js";

import {
  broadcast,
  sendPlayer,
  setRoomState,
  createWebSocketServer,
  playerRooms
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

import {
  createAuthRouter
} from "./auth.js";

import {
  createAdminRouter
} from "./admin.js";


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
// MODULE
// =====================


// Quản lý phòng

const roomUtils =
  createRoomUtils(
    broadcast,
    db,
    playerRooms
  );


// Quản lý game

const gameManager =
  createGameManager(
    db,
    sendPlayer,
    broadcast,
    setRoomState
  );


// Admin

const adminRouter =
  createAdminRouter(
    db,
    gameManager
  );


// Router phòng

const roomRouter =
  createRoomRouter(
    db,
    broadcast,
    roomUtils,
    gameManager,
    playerRooms
  );


// Auth

const authRouter =
  createAuthRouter(
    db
  );


// =====================
// ROUTES
// =====================

app.get("/",(_,res)=>{

  res.json({

    status:"online",

    game:"Werewolf Online Server",

    version:"V3"

  });

});


app.use(
  "/room",
  roomRouter
);


app.use(
  "/admin",
  adminRouter
);


app.use(
  "/auth",
  authRouter
);


// =====================
// START SERVER
// =====================

const server =
  app.listen(
    PORT,
    ()=>{

      console.log(
        "🚀 Server running:",
        PORT
      );

    }
  );



server.on(
  "error",
  (err)=>{

    console.error(
      "❌ Server error:",
      err.message
    );

    process.exit(1);

  }
);



// =====================
// WEBSOCKET
// =====================

createWebSocketServer(
  server,
  {
    sendRoom:
      roomUtils.sendRoom,

    gameManager,

    playerRooms
  }
);



// =====================
// CRON
// =====================


// Xóa phòng trống

setInterval(

  roomUtils.autoDeleteEmptyRooms,

  60_000

);


// Kiểm tra người chơi offline

setInterval(

  roomUtils.checkOffline,

  30_000

);



// =====================
// SHUTDOWN
// =====================

process.on(
  "SIGINT",
  ()=>{

    console.log(
      "🛑 Server shutting down..."
    );

    process.exit();

  }
);
