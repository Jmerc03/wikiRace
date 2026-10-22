import { WebSocket } from "ws";
import type { PresenceSnapshot } from "@bingo/shared";

type Member = { sockets: Set<WebSocket>; grace?: ReturnType<typeof setTimeout> };
type Room = { watchers: Set<WebSocket>; members: Map<string, Member> };

/** Ephemeral per-process observation; never game state or a readiness gate. */
export function createPlayerPresence(graceMs = 10000) {
  const rooms = new Map<string, Room>();
  const bindings = new Map<WebSocket, { gameId: string; playerId?: string }>();
  let disposed = false;
  const roomFor = (gameId: string) => {
    let room = rooms.get(gameId);
    if (!room) { room = { watchers: new Set(), members: new Map() }; rooms.set(gameId, room); }
    return room;
  };
  const clean = (gameId: string, room: Room) => { if (!room.watchers.size && !room.members.size) rooms.delete(gameId); };
  const snapshot = (gameId: string, room: Room): PresenceSnapshot => ({
    type: "PRESENCE_UPDATED", gameId,
    players: [...room.members].map(([playerId, member]) => ({ playerId, status: member.sockets.size ? "online" : "reconnecting" })),
  });
  const send = (socket: WebSocket, message: PresenceSnapshot) => {
    if (socket.readyState !== WebSocket.OPEN) return;
    try { socket.send(JSON.stringify(message), error => { if (error) socket.terminate(); }); }
    catch { socket.terminate(); }
  };
  const publish = (gameId: string, room: Room) => {
    const message = snapshot(gameId, room);
    for (const socket of room.watchers) send(socket, message);
  };
  function detach(socket: WebSocket) {
    const binding = bindings.get(socket);
    if (!binding) return;
    bindings.delete(socket);
    const room = rooms.get(binding.gameId);
    if (!room) return;
    room.watchers.delete(socket);
    const member = binding.playerId ? room.members.get(binding.playerId) : undefined;
    if (member && member.sockets.delete(socket) && !member.sockets.size) {
      const playerId = binding.playerId!;
      member.grace = setTimeout(() => {
        room.members.delete(playerId); publish(binding.gameId, room); clean(binding.gameId, room);
      }, graceMs);
      member.grace.unref();
      publish(binding.gameId, room);
    }
    clean(binding.gameId, room);
  }
  function watch(gameId: string, socket: WebSocket) {
    if (disposed || socket.readyState !== WebSocket.OPEN) return false;
    if (!bindings.has(socket)) {
      bindings.set(socket, { gameId });
      roomFor(gameId).watchers.add(socket);
      socket.once("close", () => detach(socket));
      send(socket, snapshot(gameId, roomFor(gameId)));
    }
    return true;
  }
  return {
    watch,
    refresh(socket: WebSocket) {
      const binding = bindings.get(socket); const room = binding ? rooms.get(binding.gameId) : undefined;
      if (binding && room) send(socket, snapshot(binding.gameId, room));
    },
    /** Called only after membership authentication while holding the game lock. */
    authenticate(gameId: string, playerId: string, socket: WebSocket) {
      if (!watch(gameId, socket)) return;
      const binding = bindings.get(socket)!;
      if (binding.gameId !== gameId || binding.playerId) return;
      binding.playerId = playerId;
      const room = roomFor(gameId);
      const member = room.members.get(playerId) ?? { sockets: new Set<WebSocket>() };
      const wasOnline = member.sockets.size > 0;
      clearTimeout(member.grace); member.grace = undefined;
      member.sockets.add(socket); room.members.set(playerId, member);
      if (!wasOnline) publish(gameId, room);
    },
    revoke(gameId: string, playerId: string) {
      const room = rooms.get(gameId); const member = room?.members.get(playerId);
      if (!room || !member) return;
      clearTimeout(member.grace); room.members.delete(playerId);
      for (const socket of member.sockets) {
        const binding = bindings.get(socket); if (binding) binding.playerId = undefined;
        socket.close(1008, "Player session ended");
      }
      publish(gameId, room); clean(gameId, room);
    },
    dispose() {
      disposed = true;
      for (const room of rooms.values()) for (const member of room.members.values()) clearTimeout(member.grace);
      rooms.clear(); bindings.clear();
    },
  };
}
export type PlayerPresence = ReturnType<typeof createPlayerPresence>;
