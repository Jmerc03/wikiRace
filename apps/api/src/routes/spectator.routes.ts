import type { FastifyInstance } from "fastify";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import { prisma } from "../db/prisma.js";
import { buildGameState } from "../services/game-state.js";
import { GameError } from "../game-errors.js";

export async function spectatorRoutes(app: FastifyInstance) {
  const publicRoot = new URL("../../public/", import.meta.url);
  const assets = [
    ["/assets/viewer.js", "viewer.js", "text/javascript; charset=utf-8"],
    ["/assets/viewer.css", "viewer.css", "text/css; charset=utf-8"],
  ];
  for (const [path, file, type] of assets) app.get(path, async (_request, reply) => {
    return reply.type(type).send(await readFile(new URL(file, publicRoot)));
  });
  app.get("/assets/invitation.js", async (_request, reply) => reply.type("text/javascript; charset=utf-8")
    .send(await readFile(new URL("../../../../packages/shared/dist/invitation.js", import.meta.url))));
  for (const path of ["/", "/join/:gameId", "/spectate/:gameId", "/overlay/:gameId"]) app.get(path, async (_request, reply) => {
    return reply.header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'self'; frame-ancestors 'self'")
      .header("X-Content-Type-Options", "nosniff").type("text/html; charset=utf-8").send(await readFile(new URL("index.html", publicRoot)));
  });
  app.get("/downloads/wikirace-extension.zip", async (_request, reply) => {
    try {
      return reply.header("Content-Disposition", 'attachment; filename="wikirace-extension.zip"')
        .type("application/zip").send(await readFile(new URL("downloads/wikirace-extension.zip", publicRoot)));
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") throw new GameError(503, "The extension package is not built yet. The operator can run npm run build.");
      throw error;
    }
  });
  app.get("/games/:gameId/spectator", async request => {
    const { gameId } = z.object({ gameId: z.uuid() }).parse(request.params);
    const query = z.object({ playerId: z.uuid().optional() }).parse(request.query);
    return prisma.$transaction(async tx => {
      const game = await tx.game.findUnique({ where: { id: gameId }, select: { hostPlayerId: true, winnerPlayerId: true } });
      if (!game) throw new GameError(404, "Game not found. Check the ID with the host.");
      let playerId = query.playerId ?? game.winnerPlayerId ?? game.hostPlayerId;
      if (!playerId) playerId = (await tx.player.findFirst({ where: { gameId }, orderBy: [{ joinedAt: "asc" }, { id: "asc" }] }))?.id ?? null;
      if (playerId && !await tx.player.findFirst({ where: { id: playerId, gameId } })) throw new GameError(404, "That player is not in this game");
      return { ...await buildGameState(tx, gameId, playerId), spectator: true };
    }, { isolationLevel: "RepeatableRead" });
  });
}
