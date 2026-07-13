import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { db } from "./firebase.js";
import { broadcast, createWebSocketServer } from "./websocket.js";
import { createRoomUtils } from "./roomUtils.js";
import { createRoomRouter } from "./room.js";

process.on("SIGTERM", () => {
  console.log("⚠️ Nhận SIGTERM từ hệ thống");
});

process.on("SIGINT", () => {
  console.log("⚠️ Nhận SIGINT");
});

// ✅ dotenv.config() CHỈ Ở ĐÂY MỘT CHỖ DUY NHẤ
dotenv.config();

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

// ✅ 1. TẠO TẤT CẢ PHỤ THUỘC TỪ TRÊN XUỐNG
const roomUtils = createRoomUtils(broadcast, db); // ⭐ tiêm vào
const roomRouter = createRoomRouter(db, broadcast, roomUtils);

// ✅ 2. Gắn route
app.get("/", (_, res) => res.json({
  status:"online", game:"Werewolf Online Server", version:"V2"
}));
app.use("/room", roomRouter);

// ✅ 3. Khởi động HTTP
const server = app.listen(PORT, () =>
  console.log("🚀 Server running on port", PORT)
);

// ✅ 4. Khởi động WS, TRUYỀN sendRoom vào
createWebSocketServer(server, { sendRoom: roomUtils.sendRoom });

// ✅ 5. Cron
setInterval(roomUtils.autoDeleteEmptyRooms, 60_000);
setInterval(roomUtils.checkOffline, 30_000);

