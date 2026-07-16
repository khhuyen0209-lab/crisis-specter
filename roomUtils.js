/**
 * ⭐ FACTORY PATTERN — phá vỡ hoàn toàn import vòng
 * Không import websocket, không import room, không import server
 *
 * broadcast & db được đưa vào từ bên ngoài lúc khởi tạo
 */

export function createRoomUtils(broadcast, db) {


  // =====================
  // TẠO MÃ PHÒNG
  // =====================

  function randomRoom() {

    const chars = "ABCDEFGH123456789";

    let code = "";

    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }

    return code;
  }



  // =====================
  // GỬI DỮ LIỆU PHÒNG
  // =====================

  async function sendRoom(room) {

    const ref = db.collection("rooms").doc(room);

    const snap = await ref.get();

    if (!snap.exists) return;


    const data = snap.data();


    const players = await ref
      .collection("players")
      .get();


    const list = players.docs.map(p => ({
      id: p.id,
      ...p.data()
    }));


    // broadcast được truyền từ ngoài vào
    broadcast(room, {

      type: "room",

      room,

      host: data.host,

      locked: data.locked,

      maxPlayers: data.maxPlayers,

      status: data.status,

      lastActive: data.lastActive,

      players: list

    });

  }



  // =====================
  // CHUYỂN CHỦ PHÒNG
  // =====================

  async function transferHostWhenLeave(room, uid) {

    const roomRef = db
      .collection("rooms")
      .doc(room);


    const snap = await roomRef.get();


    if (
      !snap.exists ||
      snap.data().host !== uid
    ) {
      return;
    }



    const players = await roomRef
      .collection("players")
      .get();



    // Không còn ai trong phòng

    if (players.empty) {

      await roomRef.update({

        host: null,

        empty: true,

        lastActive: Date.now()

      });


      console.log("Room empty:", room);

      return;

    }



    const newHost = players.docs[0].id;



    await roomRef.update({

      host: newHost,

      empty: false,

      lastActive: Date.now()

    });


    console.log("New host:", newHost);


    await sendRoom(room);

  }



  // =====================
  // KIỂM TRA NGƯỜI OFFLINE
  // =====================

  async function checkOffline() {

    try {

      const now = Date.now();


      const rooms = await db
        .collection("rooms")
        .get();



      for (const room of rooms.docs) {

  const roomData = room.data();

  // Chỉ kick khi phòng đang chờ
  if (roomData.status !== "waiting") {
    continue;
  }

  const players = await room.ref
    .collection("players")
    .get();

  for (const p of players.docs) {

    if (
      p.data().lastSeen &&
      now - p.data().lastSeen > 120000
    ) {

      await p.ref.delete();

      await transferHostWhenLeave(
        room.id,
        p.id
      );

      console.log(
        "Kick offline:",
        p.id
      );

    }

  }

  await sendRoom(room.id);

}


    } catch (e) {

      console.log(
        "Check offline error:",
        e.message
      );

    }

  }



  // =====================
  // XÓA PHÒNG TRỐNG
  // =====================

  async function autoDeleteEmptyRooms() {

    try {

      const now = Date.now();


      const rooms = await db
        .collection("rooms")
        .get();



      for (const r of rooms.docs) {


        const players = await r.ref
          .collection("players")
          .get();



        if (
          players.empty &&
          now - r.data().lastActive >
          15 * 60 * 1000
        ) {


          await r.ref.delete();


          console.log(
            "🗑 Deleted room:",
            r.id
          );

        }

      }


    } catch (e) {

      console.log(
        "Auto delete error:",
        e.message
      );

    }

  }



  // =====================
  // EXPORT
  // =====================

  return {

    randomRoom,

    sendRoom,

    transferHostWhenLeave,

    checkOffline,

    autoDeleteEmptyRooms

  };

      }
