import { WebSocketServer } from "ws";
import { db } from "./firebase.js";


export const clients = [];


// Gửi 1 kết nối

export function send(ws, data) {

  if(ws.readyState === 1){

    ws.send(JSON.stringify(data));

  }

}



// Gửi cả phòng

export function broadcast(room, data) {

  clients.forEach(ws=>{

    if(
      ws.room === room &&
      ws.readyState === 1
    ){

      send(ws,data);

    }

  });

}



// Gửi riêng 1 người

export function sendPlayer(uid, data){

  clients.forEach(ws=>{

    if(
      ws.uid === uid &&
      ws.readyState === 1
    ){

      send(ws,data);

    }

  });

}



// Tạo WebSocket

export function createWebSocketServer(server,{sendRoom}){


  const wss =
    new WebSocketServer({
      server
    });


  console.log(
    "🐺 WebSocket Server Ready"
  );



  wss.on("connection",(ws)=>{


    console.log(
      "🔌 WebSocket connected"
    );


    clients.push(ws);



    send(ws,{
      type:"connected",
      message:"WebSocket online"
    });



    ws.on("message",async(raw)=>{


      try{


        const data =
          JSON.parse(raw);



        // Xác thực người chơi

        if(data.type==="auth"){

          ws.uid=data.uid;

          return;

        }



        // Vào phòng

        if(data.type==="join"){

          ws.room=data.room;

          send(ws,{
            type:"joined",
            room:data.room
          });


          await sendRoom(data.room);

        }



        // Ping

        if(data.type==="ping"){

          send(ws,{
            type:"pong",
            time:data.time
          });

        }



        // Heartbeat

        if(
          data.type==="heartbeat" &&
          data.room &&
          data.uid
        ){

          const ref =
            db
            .collection("rooms")
            .doc(data.room)
            .collection("players")
            .doc(data.uid);


          if((await ref.get()).exists){

            await ref.update({
              lastSeen:Date.now()
            });

          }

        }



        // Chat

        if(data.type==="chat"){

          broadcast(
            data.room,
            {
              type:"chat",
              name:data.uid,
              text:data.text
            }
          );

        }



      }catch(e){

        console.log(
          "WS Error:",
          e.message
        );

      }


    });



    ws.on("close",()=>{


      const i =
        clients.indexOf(ws);


      if(i>-1){

        clients.splice(i,1);

      }


    });



    ws.on("error",(err)=>{


      console.log(
        "❌ WS Error:",
        err.message
      );


    });


  });



  return wss;

}            try {


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
