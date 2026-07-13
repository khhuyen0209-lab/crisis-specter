import { WebSocketServer } from "ws";
import { db } from "./firebase.js";


// =====================
// QUẢN LÝ CLIENT
// =====================

export const clients = [];


// =====================
// GỬI TIN NHẮN
// =====================

export function send(ws, data) {

    if (ws.readyState === 1) {

        ws.send(
            JSON.stringify(data)
        );

    }

}


// =====================
// GỬI TIN TOÀN BỘ PHÒNG
// =====================

export function broadcast(room, data) {

    clients.forEach(ws => {

        if (
            ws.room === room &&
            ws.readyState === 1
        ) {

            send(ws, data);

        }

    });

}


// =====================
// KHỞI TẠO WEBSOCKET SERVER
// =====================

/*
    sendRoom được truyền từ bên ngoài

    websocket.js KHÔNG import roomUtils
    => không tạo import vòng
*/

export function createWebSocketServer(
    server,
    { sendRoom }
) {

    const wss =
        new WebSocketServer({
            server
        });


    console.log(
        "🐺 WebSocket Server Ready"
    );


    wss.on(
        "connection",
        (ws) => {


        console.log(
            "🔌 WebSocket connected"
        );


        clients.push(ws);


        send(ws, {

            type:"connected",

            message:"WebSocket online"

        });



        // =====================
        // NHẬN MESSAGE
        // =====================

        ws.on(
            "message",
            async(raw)=>{


            try {


                const data =
                    JSON.parse(raw);



                // JOIN PHÒNG

                if(data.type === "join") {


                    ws.room =
                        data.room;



                    send(ws, {

                        type:"joined",

                        room:data.room

                    });



                    await sendRoom(
                        data.room
                    );


                }




                // PING

                if(data.type === "ping") {


                    send(ws, {

                        type:"pong",

                        time:data.time

                    });


                }




                // HEARTBEAT

                if(
                    data.type === "heartbeat" &&
                    data.room &&
                    data.uid
                ) {


                    const ref =
                        db
                        .collection("rooms")
                        .doc(data.room)
                        .collection("players")
                        .doc(data.uid);



                    const snap =
                        await ref.get();



                    if(snap.exists) {


                        await ref.update({

                            lastSeen:
                            Date.now()

                        });


                    }

                }




                // CHAT

                if(data.type === "chat") {


                    broadcast(
                        data.room,
                        {

                            type:"chat",

                            name:data.uid,

                            text:data.text

                        }
                    );


                }


            }

            catch(e) {


                console.log(
                    "WS Error:",
                    e.message
                );


            }


        });



        // =====================
        // NGẮT KẾT NỐI
        // =====================

        ws.on(
            "close",
            ()=>{


            const index =
                clients.indexOf(ws);



            if(index > -1) {


                clients.splice(
                    index,
                    1
                );


            }


        });



        // =====================
        // LỖI WEBSOCKET
        // =====================

        ws.on(
            "error",
            (err)=>{


            console.log(
                "❌ WS Error:",
                err.message
            );


        });


    });



    return wss;

            }
