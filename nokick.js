const fs = require("fs");
const env = {};
for (const line of fs.readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].trim();
}
const { RoomServiceClient } = require("livekit-server-sdk");
const http = env.LIVEKIT_URL.replace(/^wss:\/\//, "https://");
const svc = new RoomServiceClient(http, env.LIVEKIT_API_KEY, env.LIVEKIT_API_SECRET);
(async () => {
  const roomName = process.argv[2];
  if (!roomName) { console.log("NO_ROOM_NAME"); return; }
  let room;
  try { room = await svc.getRoom(roomName); } catch (e) { console.log("NO_ROOM"); return; }
  if (!room || !room.participants || !room.participants.length) { console.log("NO_PARTICIPANTS"); return; }
  const ids = room.participants.map((p) => p.identity);
  console.log("DISCONNECTING", roomName, ids.length, "participants");
  for (const id of ids) {
    try {
      await svc.disconnect(id, "closing active call");
      console.log("disconnected", id);
    } catch (e) { console.log("FAIL", id, e.message); }
  }
  const again = await svc.getRoom(roomName).catch(() => null);
  if (again && again.participants && again.participants.length) {
    console.log("STILL_PRESENT", again.participants.map((p) => p.identity));
  } else {
    console.log("ROOM_EMPTY_AFTER_DISCONNECT", roomName);
  }
  try { fs.unlinkSync("./nokick.js"); } catch {}
})().catch((e) => console.log("ERROR", e.message));
