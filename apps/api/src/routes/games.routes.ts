import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { generateBoard, evaluateSquare } from "@bingo/game-engine";
import type { Game } from "@bingo/shared";

const games = new Map<string, Game>();

const createGameSchema = z.object({
  mode: z.enum(["NORMAL", "LOCKOUT"]).default("NORMAL"),
});

const pageVisitSchema = z.object({
  playerId: z.string(),
  url: z.string().url(),
  title: z.string(),
  categories: z.array(z.string()).default([]),
  links: z.array(z.string()).default([]),
});

export async function gameRoutes(app: FastifyInstance) {
  app.post("/", async (request, reply) => {
    const body = createGameSchema.parse(request.body ?? {});

    const game: Game = {
      id: crypto.randomUUID(),
      mode: body.mode,
      status: "ACTIVE",
      board: generateBoard(),
      createdAt: new Date().toISOString(),
    };

    games.set(game.id, game);

    return reply.code(201).send(game);
  });

  app.get("/:gameId", async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const game = games.get(gameId);

    if (!game) {
      return reply.code(404).send({ error: "Game not found" });
    }

    return game;
  });

  app.get("/:gameId/board", async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const game = games.get(gameId);

    if (!game) {
      return reply.code(404).send({ error: "Game not found" });
    }

    return game.board;
  });

  app.post("/:gameId/events/page-visit", async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const game = games.get(gameId);

    if (!game) {
      return reply.code(404).send({ error: "Game not found" });
    }

    const event = pageVisitSchema.parse(request.body);

    const completedSquares = game.board.squares.filter((square) =>
      evaluateSquare(square, event),
    );

    return {
      gameId,
      playerId: event.playerId,
      completedSquares,
    };
  });
}
