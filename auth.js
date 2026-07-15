import express from "express";
import crypto from "crypto";

export function createAuthRouter(db){

    const router = express.Router();


    // ĐĂNG KÝ
    router.post("/register", async(req,res)=>{

        try{

            const {name} = req.body;


            if(!name){
                return res.json({
                    ok:false,
                    error:"Thiếu tên"
                });
            }


            const clean =
                name.trim();


            const key =
                clean.toLowerCase();


            // kiểm tra tên đã có chưa
            const old =
                await db
                .collection("names")
                .doc(key)
                .get();


            if(old.exists){

                return res.json({
                    ok:false,
                    error:"Tên đã tồn tại"
                });

            }



            const uid =
                "u_" + crypto.randomUUID();



            await db
            .collection("users")
            .doc(uid)
            .set({

                name:clean,

                nameKey:key,

                createdAt:Date.now()

            });



            await db
            .collection("names")
            .doc(key)
            .set({

                uid

            });



            res.json({

                ok:true,

                user:{
                    uid,
                    name:clean
                }

            });


        }catch(e){

            res.status(500).json({
                ok:false,
                error:e.message
            });

        }

    });


    return router;

}
