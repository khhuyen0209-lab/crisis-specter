const { db } = require("./firebase");

async function cleanupRooms(){

    const rooms = await db.collection("rooms").get();

    const now = Date.now();

    for(const room of rooms.docs){

        const data = room.data();

        // Không đụng phòng đang chơi
        if(data.status === "playing")
            continue;


        const players =
            await room.ref
            .collection("players")
            .get();


        // Có người thì giữ lại
        if(players.size > 0)
            continue;


        // Quá 15 phút
        if(
            data.lastActive &&
            now - data.lastActive > 15 * 60 * 1000
        ){

            await room.ref.delete();

            console.log(
                "Đã xóa phòng:",
                room.id
            );

        }

    }

}


// chạy mỗi 1 phút
setInterval(
    cleanupRooms,
    60 * 1000
);


module.exports = cleanupRooms;
