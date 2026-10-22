import { WebSocket } from "ws";
const gameConnections = new Map<string, Set<WebSocket>>();

export function addGameConnection(gameId: string, socket: WebSocket, onHeartbeat?: () => void) {
  const connections = gameConnections.get(gameId) ?? new Set<WebSocket>();
  if (connections.size >= 256) { socket.close(1013, "This game has too many viewers"); return false; }
  connections.add(socket);
  gameConnections.set(gameId, connections);
  let alive = true;
  socket.on("pong", () => { alive = true; });
  socket.on("error", () => { socket.terminate(); });
  const heartbeat = setInterval(() => {
    if (!alive) { socket.terminate(); return; }
    alive = false;
    if (socket.readyState === WebSocket.OPEN) {
      if (socket.bufferedAmount > 1048576) { socket.terminate(); return; }
      socket.ping();
      socket.send(JSON.stringify({ type: "HEARTBEAT" }));
      onHeartbeat?.();
    }
  }, 20000);
  heartbeat.unref();
  socket.on("close", () => { clearInterval(heartbeat); removeGameConnection(gameId, socket); });
  return true;
}
export function removeGameConnection(gameId: string, socket: WebSocket) {
  const connections = gameConnections.get(gameId);
  if (!connections) return;
  connections.delete(socket);
  if (!connections.size) gameConnections.delete(gameId);
}
export function broadcastToGame(gameId: string, message: unknown) {
  const connections = gameConnections.get(gameId);
  if (!connections) return;
  const payload = JSON.stringify(message);
  for (const socket of connections) {
    if (socket.readyState === WebSocket.OPEN) {
      if (socket.bufferedAmount > 1048576) { socket.terminate(); continue; }
      try { socket.send(payload, error => { if (error) socket.terminate(); }); }
      catch { socket.terminate(); }
    }
  }
}
