import type { WebSocket } from "ws";

const gameConnections = new Map<string, Set<WebSocket>>();

export function addGameConnection(gameId: string, socket: WebSocket) {
  if (!gameConnections.has(gameId)) {
    gameConnections.set(gameId, new Set());
  }

  gameConnections.get(gameId)!.add(socket);

  socket.on("close", () => {
    removeGameConnection(gameId, socket);
  });
}

export function removeGameConnection(gameId: string, socket: WebSocket) {
  const connections = gameConnections.get(gameId);

  if (!connections) return;

  connections.delete(socket);

  if (connections.size === 0) {
    gameConnections.delete(gameId);
  }
}

export function broadcastToGame(gameId: string, message: unknown) {
  const connections = gameConnections.get(gameId);

  if (!connections) return;

  const payload = JSON.stringify(message);

  for (const socket of connections) {
    if (socket.readyState === socket.OPEN) {
      socket.send(payload);
    }
  }
}
