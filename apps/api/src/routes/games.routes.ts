import type { FastifyInstance } from "fastify";
import { z } from "zod";
import { generateBoard, evaluateSquare } from "@bingo/game-engine";
import { prisma } from "../db/prisma.js";
import type { BoardSquare, PageVisitEvent } from "@bingo/shared";
import { Prisma } from "@prisma/client";

const defaultBoardConfig = {
  difficulty: "MIXED",
  vitalArticleTileCount: 15,
  genericTileCount: 10,
  maxTilesPerTopic: 3,
} as const;

const createGameSchema = z.object({
  mode: z.enum(["NORMAL", "LOCKOUT"]).default("NORMAL"),
  boardConfig: z
    .object({
      difficulty: z.enum(["EASY", "MIXED", "HARD"]).default("MIXED"),
      vitalArticleTileCount: z.number().int().min(0).max(25).default(15),
      genericTileCount: z.number().int().min(0).max(25).default(10),
      maxTilesPerTopic: z.number().int().min(1).max(25).default(3),
    })
    .default(defaultBoardConfig),
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
    const boardConfig = body.boardConfig;
    const generatedBoard = generateBoard(boardConfig);

    const game = await prisma.game.create({
      data: {
        mode: body.mode,
        status: "ACTIVE",
        boardConfig: boardConfig as Prisma.InputJsonValue,
        board: {
          create: {
            size: generatedBoard.size,
            squares: {
              create: generatedBoard.squares.map((square) => ({
                position: square.position,
                type: square.type,
                label: square.label,
                condition: square.condition as Prisma.InputJsonValue,
                difficulty: square.difficulty,
              })),
            },
          },
        },
        players: {
          create: {
            displayName: "Player 1",
          },
        },
      },
      include: {
        board: {
          include: {
            squares: true,
          },
        },
        players: true,
      },
    });

    return reply.code(201).send(game);
  });

  app.get("/:gameId", async (request, reply) => {
    const { gameId } = request.params as { gameId: string };

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        board: {
          include: {
            squares: true,
          },
        },
        players: true,
      },
    });

    if (!game) {
      return reply.code(404).send({ error: "Game not found" });
    }

    return game;
  });

  app.get("/:gameId/board", async (request, reply) => {
    const { gameId } = request.params as { gameId: string };

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        board: {
          include: {
            squares: true,
          },
        },
      },
    });

    if (!game || !game.board) {
      return reply.code(404).send({ error: "Board not found" });
    }

    return game.board;
  });

  app.get("/:gameId/state", async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const playerId = (request.query as { playerId?: string }).playerId;

    if (!playerId) {
      return reply.code(400).send({ error: "playerId is required" });
    }

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        board: {
          include: {
            squares: true,
          },
        },
      },
    });

    if (!game || !game.board) {
      return reply.code(404).send({ error: "Game not found" });
    }

    const completions = await prisma.squareCompletion.findMany({
      where: {
        gameId,
        playerId,
      },
    });

    return {
      gameId,
      playerId,
      boardConfig: game.boardConfig,
      board: game.board,
      completedSquareIds: completions.map((completion) => completion.squareId),
    };
  });

  app.post("/:gameId/events/page-visit", async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const event = pageVisitSchema.parse(request.body);

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        board: {
          include: {
            squares: true,
          },
        },
        players: true,
      },
    });

    if (!game || !game.board) {
      return reply.code(404).send({ error: "Game not found" });
    }

    let player = game.players.find((p) => p.id === event.playerId);

    if (!player) {
      player = await prisma.player.create({
        data: {
          id: event.playerId,
          gameId,
          displayName: "Player 1",
        },
      });
    }

    const visit = await prisma.pageVisitEvent.create({
      data: {
        gameId,
        playerId: player.id,
        url: event.url,
        title: event.title,
        categories: event.categories,
        links: event.links,
      },
    });

    const pageVisitEvent: PageVisitEvent = {
      playerId: player.id,
      url: event.url,
      title: event.title,
      categories: event.categories,
      links: event.links,
    };

    const completedSquares = game.board.squares.filter((square) =>
      evaluateSquare(square as BoardSquare, pageVisitEvent),
    );

    for (const square of completedSquares) {
      await prisma.squareCompletion.upsert({
        where: {
          playerId_squareId: {
            playerId: player.id,
            squareId: square.id,
          },
        },
        update: {},
        create: {
          gameId,
          playerId: player.id,
          squareId: square.id,
          pageVisitEventId: visit.id,
        },
      });
    }

    const completions = await prisma.squareCompletion.findMany({
      where: {
        gameId,
        playerId: player.id,
      },
    });

    return {
      gameId,
      playerId: player.id,
      completedSquares,
      completedSquareIds: completions.map((completion) => completion.squareId),
    };
  });
}
