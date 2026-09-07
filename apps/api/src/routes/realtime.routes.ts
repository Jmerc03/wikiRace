import type { FastifyInstance, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { GameError } from "../game-errors.js";
import { addGameConnection } from "../realtime/game-connections.js";

type GameRequest = FastifyRequest<{Params:{gameId:string}}>;
// The plugin's ambient Fastify augmentation does not resolve with this
// workspace's nested Fastify installation. Keep the adapter narrow and typed.
type WebSocketGet = (this: FastifyInstance, path: string,
  options: {websocket:true; preValidation:(request:GameRequest)=>Promise<void>},
  handler:(socket:WebSocket,request:GameRequest)=>void) => void;

export async function realtimeRoutes(app: FastifyInstance) {
  (app.get as unknown as WebSocketGet).call(app, "/ws/:gameId", {
    websocket: true,
    preValidation: async request => {
      const gameId = z.uuid().parse(request.params.gameId);
      if (!await prisma.game.findUnique({where:{id:gameId}, select:{id:true}})) throw new GameError(404,"Game not found");
    },
  }, (socket, request) => {
    const { gameId } = request.params;
    if (addGameConnection(gameId, socket)) socket.send(JSON.stringify({ type: "CONNECTED", gameId }));
  });
}
