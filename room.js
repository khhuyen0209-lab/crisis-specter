import express from "express";

/**
 * Tất cả phụ thuộc đều được truyền vào từ server
 * Không import trực tiếp db / broadcast / utils
 */
export function createRoomRouter(
  db,
  broadcast,
  utils,
  gameManager
) {
  const router = express.Router();
  const { randomRoom, sendRoom, transferHostWhenLeave } = utils;

  // TẠO PHÒNG
  router.post("/create", async (req, res) => {
    try {
      const { uid, maxPlayers, locked } = req.body;
      let room;
      while (true) {
        room = randomRoom();
        if (!(await db.collection("rooms").doc(room).get()).exists) break;
      }
      const ref = db.collection("rooms").doc(room);
      await ref.set({
        host: uid,
        maxPlayers: maxPlayers || 8,
        locked: locked || false, // ✅ KHỚP BẢN GỐC, không dùng !!locked
        status: "waiting",
        createdAt: Date.now(),
        lastActive: Date.now()
      });
      await ref.collection("players").doc(uid).set({
        name:"Player", avatar:"👑", seat:0, ready:true, lastSeen:Date.now()
      });
      await sendRoom(room);
      res.json({ ok:true, room });
    } catch(e){ res.status(500).json({ ok:false, error:e.message }); }
  });

  // VÀO PHÒNG
  router.post("/join", async (req, res) => {
    try {
      const { uid, room } = req.body;
      const ref = db.collection("rooms").doc(room);
      const snap = await ref.get();
      if(!snap.exists) return res.json({ ok:false, error:"Không tồn tại phòng" });
      const d = snap.data();
      if(d.locked) return res.json({ ok:false, error:"Phòng khóa" });
      const players = await ref.collection("players").get();
      if(players.size >= d.maxPlayers) return res.json({ ok:false, error:"Phòng đầy" });

      const used = players.docs.map(p => p.data().seat);
      let seat = 0; while(used.includes(seat)) seat++;

      await ref.collection("players").doc(uid).set({
        name:"Player "+(seat+1), avatar:"🙂", seat, ready:false, lastSeen:Date.now()
      });

      const nd = (await ref.get()).data();
      if(!nd.host){
        // ✅ KHỚP BẢN GỐC: set empty:false khi có chủ mới
        await ref.update({ host:uid, empty:false, lastActive:Date.now() });
      } else {
        await ref.update({ lastActive:Date.now() });
      }

      await sendRoom(room);
      res.json({ ok:true });
    } catch(e){ res.status(500).json({ ok:false, error:e.message }); }
  });

  // SẴN SÀNG
  router.post("/ready", async (req,res)=>{
    try{
      const { uid, room } = req.body;
      const ref = db.collection("rooms").doc(room).collection("players").doc(uid);
      const s = await ref.get();
      if(!s.exists) return res.json({ ok:false, error:"Không tìm thấy người chơi" });
      await ref.update({ ready: !s.data().ready });
      await sendRoom(room);
      res.json({ ok:true });
    }catch(e){ res.status(500).json({ ok:false, error:e.message }); }
  });

  // RỜI PHÒNG
  router.post("/leave", async (req,res)=>{
    try{
      const { uid, room } = req.body;
      const ref = db.collection("rooms").doc(room);
      await ref.collection("players").doc(uid).delete();
      await transferHostWhenLeave(room, uid);
      if((await ref.get()).exists){
        await ref.update({ lastActive:Date.now() });
        await sendRoom(room);
      }
      res.json({ ok:true });
    }catch(e){ res.status(500).json({ ok:false, error:e.message }); }
  });

  // ĐÁ NGƯỜI
  router.post("/kick", async (req,res)=>{
    try{
      const { host, target, room } = req.body;
      const ref = db.collection("rooms").doc(room);
      const s = await ref.get();
      if(!s.exists) return res.json({ ok:false, error:"Phòng không tồn tại" });
      if(s.data().host !== host) return res.json({ ok:false, error:"Bạn không phải chủ phòng" });
      if(host === target) return res.json({ ok:false, error:"Không thể đá chính mình" });
      await ref.collection("players").doc(target).delete();
      await ref.update({ lastActive:Date.now() });
      await sendRoom(room);
      res.json({ ok:true });
    }catch(e){ res.status(500).json({ ok:false, error:e.message }); }
  });

  // CHUYỂN CHỦ
  router.post("/transfer", async (req,res)=>{
    try{
      const { host, target, room } = req.body;
      const ref = db.collection("rooms").doc(room);
      const s = await ref.get();
      if(!s.exists) return res.json({ ok:false, error:"Phòng không tồn tại" });
      if(s.data().host !== host) return res.json({ ok:false, error:"Bạn không phải chủ phòng" });
      if(!(await ref.collection("players").doc(target).get()).exists)
        return res.json({ ok:false, error:"Người chơi không có trong phòng" });
      await ref.update({ host:target, lastActive:Date.now() });
      await sendRoom(room);
      res.json({ ok:true });
    }catch(e){ res.status(500).json({ ok:false, error:e.message }); }
  });

  // VÀO NHANH
  router.get("/quick", async (req,res)=>{
    try{
      const rooms = await db.collection("rooms").where("status","==","waiting").get();
      let found = null;
      for(const r of rooms.docs){
        if(r.data().locked) continue;
        const p = await r.ref.collection("players").get();
        if(p.size < r.data().maxPlayers){ found = r.id; break; }
      }
      res.json({ room:found });
    }catch(e){ res.status(500).json({ error:e.message }); }
  });

  // BẮT ĐẦU
  // BẮT ĐẦU GAME

router.post("/start", async (req,res)=>{

  try{

    const { uid, room } = req.body;


    const ref =
      db.collection("rooms").doc(room);


    const s =
      await ref.get();


    if(!s.exists){

      return res.json({
        ok:false,
        error:"Phòng không tồn tại"
      });

    }


    // kiểm tra chủ phòng

    if(s.data().host !== uid){

      return res.json({
        ok:false,
        error:"Chỉ chủ phòng mới được bắt đầu"
      });

    }



    const players =
      await ref.collection("players").get();



    if(players.size < 3){

      return res.json({
        ok:false,
        error:"Cần ít nhất 3 người chơi"
      });

    }



    // chuyển sang trạng thái chuẩn bị

    await ref.update({
  status:"preparing",
  lastActive:Date.now()
});


broadcast(room,{
  type:"game",
  phase:"preparing",
  message:"Đang chuẩn bị trò chơi..."
});


// chờ chuẩn bị 3 giây rồi bắt đầu
setTimeout(async()=>{

  await gameManager.startGame(room);

},3000);


res.json({
  ok:true,
  message:"Đã bắt đầu chuẩn bị"
});


  }catch(e){


    res.status(500).json({

      ok:false,

      error:e.message

    });


  }

});

  // CHAT
  router.get("/:id/chat", async (req,res)=>{
    try{
      const list = await db
        .collection("rooms").doc(req.params.id)
        .collection("chat").orderBy("time","asc").limit(100).get()
        .then(s => s.docs.map(x => x.data()));
      res.json(list);
    }catch(e){ res.status(500).json({ error:e.message }); }
  });

  return router;
}

