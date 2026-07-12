import express from "express";
import cors from "cors";
import { WebSocketServer } from "ws";


import { roomRoutes } 
from "./room.js";


import { startSocket } 
from "./websocket.js";



const app =
express();



app.use(cors());

app.use(express.json());



app.get("/",(req,res)=>{


res.json({

    status:"online",

    game:"Werewolf Crisis",

    version:"V2"

});


});



// ROUTE PHÒNG

roomRoutes(app);




// START HTTP SERVER

const PORT =
process.env.PORT || 8080;



const server =
app.listen(PORT,()=>{


console.log(
"🚀 Server running on port",
PORT
);


});




// WEBSOCKET

const wss =
new WebSocketServer({

    server

});



startSocket(wss);




console.log(
"🐺 Werewolf Server Ready"
);
