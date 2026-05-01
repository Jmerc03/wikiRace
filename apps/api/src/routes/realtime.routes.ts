import type { FastifyInstance } from "fastify";
import { addGameConnection } from "../realtime/game-connections.js";

type GameRouteParams = {
  gameId: string;
};

export async function realtimeRoutes(app: FastifyInstance) {
  const websocketGet = app.get as unknown as (
    this: FastifyInstance,
    path: string,
    options: { websocket: true },
    handler: (socket: any, request: { params: GameRouteParams }) => void,
  ) => void;

  websocketGet.call(
    app,
    "/ws/:gameId",
    { websocket: true },
    (socket, request) => {
      const { gameId } = request.params;

      addGameConnection(gameId, socket);

      socket.send(
        JSON.stringify({
          type: "CONNECTED",
          gameId,
        }),
      );
    },
  );
}
