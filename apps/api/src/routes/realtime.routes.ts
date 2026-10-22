import type { FastifyInstance, FastifyRequest } from "fastify";
import type { WebSocket } from "ws";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { GameError } from "../game-errors.js";
import { addGameConnection } from "../realtime/game-connections.js";
import type { PlayerPresence } from "../realtime/player-presence.js";
import { requirePlayerToken } from "../services/game-auth.js";
import type { BetaConfig } from "../config/beta.js";
import { createSocketBudget, WindowLimiter } from "../services/beta-guards.js";

type GameRequest = FastifyRequest<{Params:{gameId:string}}>;
// The plugin's ambient Fastify augmentation does not resolve with this
// workspace's nested Fastify installation. Keep the adapter narrow and typed.
type WebSocketGet = (this: FastifyInstance, path: string,
  options: {websocket:true; preValidation:(request:GameRequest)=>Promise<void>},
  handler:(socket:WebSocket,request:GameRequest)=>void) => void;

export async function realtimeRoutes(app: FastifyInstance, { presence, beta }: { presence: PlayerPresence; beta?: BetaConfig }) {
  const reserve = createSocketBudget();
  (app.get as unknown as WebSocketGet).call(app, "/ws/:gameId", {
    websocket: true,
    preValidation: async request => {
      const gameId = z.uuid().parse(request.params.gameId);
      if (!await prisma.game.findUnique({where:{id:gameId}, select:{id:true}})) throw new GameError(404,"Game not found");
    },
  }, (socket, request) => {
    const { gameId } = request.params;
    if (beta && !reserve(socket, request.ip)) return;
    if (!addGameConnection(gameId, socket, () => presence.refresh(socket))) return;
    socket.send(JSON.stringify({ type: "CONNECTED", gameId, capabilities: ["player-presence-v1"] }));
    let authenticating = false;
    const frames = new WindowLimiter(1);
    // Credentials stay out of URLs, HTTP access logs and public snapshots.
    socket.on("message", data => {
      if (beta && frames.take("frames", 30, 60000)) { socket.close(1008, "Too many messages"); return; }
      let message: any;
      try { message = JSON.parse(String(data)); } catch { return; }
      if (message?.type === "WATCH_PRESENCE") { presence.watch(gameId, socket); return; }
      if (message?.type !== "AUTHENTICATE_PRESENCE" || authenticating) return;
      authenticating = true;
      const parsed = z.object({ playerId: z.uuid(), playerToken: z.string().regex(/^[A-Za-z0-9_-]{43}$/) }).safeParse(message);
      if (!parsed.success) { socket.close(1008, "Invalid player session"); return; }
      void prisma.$transaction(async tx => {
        await tx.$queryRaw`SELECT "id" FROM "Game" WHERE "id" = ${gameId} FOR UPDATE`;
        await requirePlayerToken(tx, parsed.data.playerToken, gameId, parsed.data.playerId);
        presence.authenticate(gameId, parsed.data.playerId, socket);
      }).catch(() => { socket.close(1008, "Player presence unavailable"); });
    });
  });
}
