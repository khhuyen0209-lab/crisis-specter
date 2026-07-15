import express from "express";


export function createAdminRouter(
    db,
    gameManager
){

    const router = express.Router();



    // TEST STATUS
    router.get("/status", async (req,res)=>{

        try{


            const rooms =
            await db
            .collection("rooms")
            .get();



            let waiting = 0;
            let playing = 0;



            rooms.forEach(room=>{

                const data =
                room.data();


                if(data.status==="waiting")
                    waiting++;


                if(data.status==="playing")
                    playing++;

            });



            const memory =
            process.memoryUsage();



            res.json({

                status:"online",

                uptime:
                Math.floor(
                    process.uptime()
                )
                +"s",


                ram:
                Math.round(
                    memory.heapUsed /
                    1024 /
                    1024
                )
                +" MB",


                rooms:
                rooms.size,


                waiting,

                playing


            });



        }
        catch(e){

            res.status(500).json({

                error:e.message

            });

        }


    });



    return router;

}
