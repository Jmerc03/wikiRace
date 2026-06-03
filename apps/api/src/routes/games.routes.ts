import type { FastifyInstance } from "fastify";
import { z } from "zod";
import {
  generateBoard,
  evaluateSquare,
  getWinningLineResult,
} from "@bingo/game-engine";
import { prisma } from "../db/prisma.js";
import type { BoardSquare, PageVisitEvent } from "@bingo/shared";
import { Prisma } from "@prisma/client";
import { broadcastToGame } from "../realtime/game-connections.js";

const defaultBoardConfig = {
  difficulty: "MIXED",
  vitalArticleTileCount: 15,
  genericTileCount: 10,
  maxTilesPerTopic: 3,
} as const;

const PLAYER_COLORS = [
  "rgba(255, 107, 107, 0.35)",
  "rgba(77, 171, 247, 0.35)",
  "rgba(81, 207, 102, 0.35)",
  "rgba(252, 196, 25, 0.35)",
  "rgba(177, 151, 252, 0.35)",
  "rgba(255, 146, 43, 0.35)",
];

const TEAM_COLORS = [
  "rgba(224, 49, 49, 0.35)",
  "rgba(25, 113, 194, 0.35)",
  "rgba(47, 158, 68, 0.35)",
  "rgba(240, 140, 0, 0.35)",
  "rgba(103, 65, 217, 0.35)",
  "rgba(194, 37, 92, 0.35)",
];

function getTeamColor(teamNumber: number) {
  return TEAM_COLORS[(teamNumber - 1) % TEAM_COLORS.length];
}

function getPlayerColor(playerNumber: number) {
  return PLAYER_COLORS[(playerNumber - 1) % PLAYER_COLORS.length];
}

type LockoutClaimForWinCheck = {
  squareId: string;
  playerId: string;
  player: {
    teamId: string | null;
  };
};

type SquareForWinCheck = {
  id: string;
  position: number;
};

function getLockoutWinningLineResult(
  claims: LockoutClaimForWinCheck[],
  squares: SquareForWinCheck[],
) {
  const positionsByOwner = new Map<string, number[]>();

  for (const claim of claims) {
    const ownerKey = claim.player.teamId
      ? `team:${claim.player.teamId}`
      : `player:${claim.playerId}`;

    const square = squares.find((square) => square.id === claim.squareId);

    if (!square) {
      continue;
    }

    const positions = positionsByOwner.get(ownerKey) ?? [];
    positions.push(square.position);
    positionsByOwner.set(ownerKey, positions);
  }

  for (const positions of positionsByOwner.values()) {
    const winningLineResult = getWinningLineResult(positions);

    if (winningLineResult) {
      return winningLineResult;
    }
  }

  return null;
}

function buildTeamSummaries(
  teams: { id: string; name: string; color: string }[],
  players: {
    id: string;
    displayName: string;
    color: string | null;
    teamId: string | null;
  }[],
) {
  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    color: team.color,
    players: players
      .filter((player) => player.teamId === team.id)
      .map((player) => ({
        id: player.id,
        displayName: player.displayName,
        color: player.color,
      })),
  }));
}

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

const createPlayerSchema = z.object({
  displayName: z.string().trim().min(1).max(40).default("Player"),
});

const createTeamSchema = z.object({
  name: z.string().trim().min(1).max(40),
});

const joinTeamSchema = z.object({
  playerId: z.string(),
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
    const displayName =
      request.body &&
      typeof request.body === "object" &&
      "displayName" in request.body
        ? createPlayerSchema.parse(request.body).displayName
        : "Player 1";
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
            displayName,
            color: getPlayerColor(1),
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
        teams: true,
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
        teams: true,
      },
    });

    if (!game) {
      return reply.code(404).send({ error: "Game not found" });
    }

    return game;
  });

  app.post("/:gameId/teams", async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const body = createTeamSchema.parse(request.body ?? {});

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        teams: true,
      },
    });

    if (!game) {
      return reply.code(404).send({ error: "Game not found" });
    }

    if (game.status === "FINISHED") {
      return reply.code(409).send({ error: "Game is already finished" });
    }

    const teamNumber = game.teams.length + 1;

    const team = await prisma.team.create({
      data: {
        gameId,
        name: body.name,
        color: getTeamColor(teamNumber),
      },
    });

    return team;
  });

  app.post("/:gameId/teams/:teamId/join", async (request, reply) => {
    const { gameId, teamId } = request.params as {
      gameId: string;
      teamId: string;
    };

    const body = joinTeamSchema.parse(request.body ?? {});

    const team = await prisma.team.findFirst({
      where: {
        id: teamId,
        gameId,
      },
    });

    if (!team) {
      return reply.code(404).send({ error: "Team not found" });
    }

    const player = await prisma.player.update({
      where: {
        id: body.playerId,
      },
      data: {
        teamId,
        color: team.color,
      },
    });

    return {
      team,
      player,
    };
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
        players: true,
        teams: true,
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
        players: true,
        teams: true,
      },
    });

    if (!game || !game.board) {
      return reply.code(404).send({ error: "Game not found" });
    }

    if (game.mode === "LOCKOUT") {
      const claims = await prisma.squareClaim.findMany({
        where: {
          gameId,
        },
        include: {
          player: true,
        },
      });

      const winningLineResult = getLockoutWinningLineResult(
        claims,
        game.board.squares,
      );
      const winningLine = winningLineResult?.positions ?? null;
      const winningLineType = winningLineResult?.type ?? null;
      const winner = winningLineResult !== null;

      return {
        gameId,
        playerId,
        mode: game.mode,
        status: game.status,
        boardConfig: game.boardConfig,
        playerCount: game.players.length,
        players: game.players.map((player) => ({
          id: player.id,
          displayName: player.displayName,
          color: player.color,
          teamId: player.teamId,
        })),
        teams: buildTeamSummaries(game.teams, game.players),
        board: game.board,
        completedSquareIds: claims.map((claim) => claim.squareId),
        winner,
        winningLine,
        winningLineType,
        squareClaims: claims.map((claim) => {
          const team = game.teams.find(
            (team) => team.id === claim.player.teamId,
          );

          return {
            squareId: claim.squareId,
            playerId: claim.playerId,
            playerName: claim.player.displayName,
            playerColor: claim.player.color,
            teamId: claim.player.teamId,
            teamName: team?.name ?? null,
            teamColor: team?.color ?? null,
            claimedAt: claim.claimedAt,
          };
        }),
      };
    }

    const completions = await prisma.squareCompletion.findMany({
      where: {
        gameId,
        playerId,
      },
    });

    const completedSquareIds = completions.map(
      (completion) => completion.squareId,
    );

    const completedPositions = game.board.squares
      .filter((square) => completedSquareIds.includes(square.id))
      .map((square) => square.position);

    const winningLineResult = getWinningLineResult(completedPositions);
    const winningLine = winningLineResult?.positions ?? null;
    const winningLineType = winningLineResult?.type ?? null;
    const winner = winningLineResult !== null;

    return {
      gameId,
      playerId,
      mode: game.mode,
      status: game.status,
      boardConfig: game.boardConfig,
      playerCount: game.players.length,
      players: game.players.map((player) => ({
        id: player.id,
        displayName: player.displayName,
        color: player.color,
        teamId: player.teamId,
      })),
      teams: buildTeamSummaries(game.teams, game.players),
      board: game.board,
      completedSquareIds,
      winner,
      winningLine,
      winningLineType,
    };
  });

  app.post("/:gameId/players", async (request, reply) => {
    const { gameId } = request.params as { gameId: string };
    const body = createPlayerSchema.parse(request.body ?? {});

    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        board: {
          include: {
            squares: true,
          },
        },
        players: true,
        teams: true,
      },
    });

    if (!game) {
      return reply.code(404).send({ error: "Game not found" });
    }

    if (game.status === "FINISHED") {
      return reply.code(409).send({ error: "Game is already finished" });
    }

    const playerNumber = game.players.length + 1;
    const displayName =
      body.displayName === "Player"
        ? `Player ${playerNumber}`
        : body.displayName;

    const player = await prisma.player.create({
      data: {
        gameId,
        displayName,
        color: getPlayerColor(playerNumber),
      },
    });

    let completedSquareIds: string[] = [];
    let squareClaims: {
      squareId: string;
      playerId: string;
      playerName: string;
      playerColor: string | null;
      teamId: string | null;
      teamName: string | null;
      teamColor: string | null;
      claimedAt: Date;
    }[] = [];

    if (game.mode === "LOCKOUT") {
      const claims = await prisma.squareClaim.findMany({
        where: {
          gameId,
        },
        include: {
          player: true,
        },
      });

      completedSquareIds = claims.map((c) => c.squareId);
      squareClaims = claims.map((claim) => {
        const team = game.teams.find((team) => team.id === claim.player.teamId);

        return {
          squareId: claim.squareId,
          playerId: claim.playerId,
          playerName: claim.player.displayName,
          playerColor: claim.player.color,
          teamId: claim.player.teamId,
          teamName: team?.name ?? null,
          teamColor: team?.color ?? null,
          claimedAt: claim.claimedAt,
        };
      });
    } else {
      const completions = await prisma.squareCompletion.findMany({
        where: {
          gameId,
          playerId: player.id,
        },
      });

      completedSquareIds = completions.map((c) => c.squareId);
    }

    return {
      gameId,
      playerId: player.id,
      playerName: player.displayName,
      playerCount: game.players.length + 1,
      players: [
        ...game.players.map((existingPlayer) => ({
          id: existingPlayer.id,
          displayName: existingPlayer.displayName,
          color: existingPlayer.color,
          teamId: existingPlayer.teamId,
        })),
        {
          id: player.id,
          displayName: player.displayName,
          color: player.color,
          teamId: player.teamId,
        },
      ],
      teams: buildTeamSummaries(game.teams, game.players),
      mode: game.mode,
      status: game.status,
      boardConfig: game.boardConfig,
      board: game.board,
      completedSquareIds,
      squareClaims,
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
        teams: true,
      },
    });

    if (!game || !game.board) {
      return reply.code(404).send({ error: "Game not found" });
    }

    if (game.status === "FINISHED") {
      const state = await buildGameState(gameId, event.playerId);

      if (!state) {
        return reply.code(404).send({ error: "Game not found" });
      }

      return state;
    }

    let player = game.players.find((p) => p.id === event.playerId);

    if (!player) {
      const playerNumber = game.players.length + 1;

      player = await prisma.player.create({
        data: {
          id: event.playerId,
          gameId,
          displayName: `Player ${playerNumber}`,
          color: getPlayerColor(playerNumber),
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

    if (game.mode === "LOCKOUT") {
      const newlyClaimedSquares: typeof completedSquares = [];

      for (const square of completedSquares) {
        const existingClaim = await prisma.squareClaim.findUnique({
          where: {
            gameId_squareId: {
              gameId,
              squareId: square.id,
            },
          },
          include: {
            player: true,
          },
        });

        if (existingClaim) {
          const samePlayer = existingClaim.playerId === player.id;
          const sameTeam =
            existingClaim.player.teamId !== null &&
            player.teamId !== null &&
            existingClaim.player.teamId === player.teamId;

          if (samePlayer || sameTeam) {
            continue;
          }

          continue;
        }

        try {
          await prisma.squareClaim.create({
            data: {
              gameId,
              playerId: player.id,
              squareId: square.id,
              pageVisitEventId: visit.id,
            },
          });

          newlyClaimedSquares.push(square);
        } catch (err) {
          console.error("Failed to create square claim:", err);
        }
      }

      const claims = await prisma.squareClaim.findMany({
        where: {
          gameId,
        },
        include: {
          player: true,
        },
      });

      const claimedSquareIds = claims.map((claim) => claim.squareId);

      const winningLineResult = getLockoutWinningLineResult(
        claims,
        game.board.squares,
      );
      const winningLine = winningLineResult?.positions ?? null;
      const winningLineType = winningLineResult?.type ?? null;
      const winner = winningLineResult !== null;

      if (winner) {
        await prisma.game.update({
          where: {
            id: gameId,
          },
          data: {
            status: "FINISHED",
          },
        });
      }

      const response = {
        gameId,
        playerId: player.id,
        mode: game.mode,
        status: winner ? "FINISHED" : game.status,
        boardConfig: game.boardConfig,
        playerCount: game.players.length,
        players: game.players.map((player) => ({
          id: player.id,
          displayName: player.displayName,
          color: player.color,
          teamId: player.teamId,
        })),
        teams: buildTeamSummaries(game.teams, game.players),
        board: game.board,
        completedSquares: newlyClaimedSquares,
        completedSquareIds: claimedSquareIds,
        winner,
        winningLine,
        winningLineType,
        squareClaims: claims.map((claim) => {
          const team = game.teams.find(
            (team) => team.id === claim.player.teamId,
          );

          return {
            squareId: claim.squareId,
            playerId: claim.playerId,
            playerName: claim.player.displayName,
            playerColor: claim.player.color,
            teamId: claim.player.teamId,
            teamName: team?.name ?? null,
            teamColor: team?.color ?? null,
            claimedAt: claim.claimedAt,
          };
        }),
      };

      broadcastToGame(gameId, {
        type: "GAME_STATE_UPDATED",
        data: response,
      });

      return response;
    }

    if (game.mode === "NORMAL") {
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

      const completedSquareIds = completions.map(
        (completion) => completion.squareId,
      );

      const completedPositions = game.board.squares
        .filter((square) => completedSquareIds.includes(square.id))
        .map((square) => square.position);

      const winningLineResult = getWinningLineResult(completedPositions);
      const winningLine = winningLineResult?.positions ?? null;
      const winningLineType = winningLineResult?.type ?? null;
      const winner = winningLineResult !== null;

      if (winner) {
        await prisma.game.update({
          where: {
            id: gameId,
          },
          data: {
            status: "FINISHED",
          },
        });
      }

      const response = {
        gameId,
        playerId: player.id,
        mode: game.mode,
        status: winner ? "FINISHED" : game.status,
        boardConfig: game.boardConfig,
        playerCount: game.players.length,
        players: game.players.map((player) => ({
          id: player.id,
          displayName: player.displayName,
          color: player.color,
          teamId: player.teamId,
        })),
        teams: buildTeamSummaries(game.teams, game.players),
        board: game.board,
        completedSquares,
        completedSquareIds: completions.map(
          (completion) => completion.squareId,
        ),
        winner,
        winningLine,
        winningLineType,
      };

      broadcastToGame(gameId, {
        type: "GAME_STATE_UPDATED",
        data: response,
      });

      return response;
    }

    return reply
      .code(400)
      .send({ error: `Unsupported game mode: ${game.mode}` });
  });

  async function buildGameState(gameId: string, playerId: string) {
    const game = await prisma.game.findUnique({
      where: { id: gameId },
      include: {
        board: {
          include: {
            squares: true,
          },
        },
        players: true,
        teams: true,
      },
    });

    if (!game || !game.board) {
      return null;
    }

    if (game.mode === "LOCKOUT") {
      const claims = await prisma.squareClaim.findMany({
        where: {
          gameId,
        },
        include: {
          player: true,
        },
      });

      const claimedSquareIds = claims.map((claim) => claim.squareId);

      const winningLineResult = getLockoutWinningLineResult(
        claims,
        game.board.squares,
      );
      const winningLine = winningLineResult?.positions ?? null;
      const winningLineType = winningLineResult?.type ?? null;
      const winner = winningLineResult !== null;

      return {
        gameId,
        playerId,
        mode: game.mode,
        status: game.status,
        boardConfig: game.boardConfig,
        playerCount: game.players.length,
        players: game.players.map((player) => ({
          id: player.id,
          displayName: player.displayName,
          color: player.color,
          teamId: player.teamId,
        })),
        teams: buildTeamSummaries(game.teams, game.players),
        board: game.board,
        completedSquareIds: claimedSquareIds,
        winner,
        winningLine,
        winningLineType,
        squareClaims: claims.map((claim) => {
          const team = game.teams.find(
            (team) => team.id === claim.player.teamId,
          );

          return {
            squareId: claim.squareId,
            playerId: claim.playerId,
            playerName: claim.player.displayName,
            playerColor: claim.player.color,
            teamId: claim.player.teamId,
            teamName: team?.name ?? null,
            teamColor: team?.color ?? null,
            claimedAt: claim.claimedAt,
          };
        }),
      };
    }

    const completions = await prisma.squareCompletion.findMany({
      where: {
        gameId,
        playerId,
      },
    });

    const completedSquareIds = completions.map(
      (completion) => completion.squareId,
    );

    const completedPositions = game.board.squares
      .filter((square) => completedSquareIds.includes(square.id))
      .map((square) => square.position);

    const winningLineResult = getWinningLineResult(completedPositions);
    const winningLine = winningLineResult?.positions ?? null;
    const winningLineType = winningLineResult?.type ?? null;
    const winner = winningLineResult !== null;

    return {
      gameId,
      playerId,
      mode: game.mode,
      status: game.status,
      boardConfig: game.boardConfig,
      playerCount: game.players.length,
      players: game.players.map((player) => ({
        id: player.id,
        displayName: player.displayName,
        color: player.color,
        teamId: player.teamId,
      })),
      teams: buildTeamSummaries(game.teams, game.players),
      board: game.board,
      completedSquareIds,
      winner,
      winningLine,
      winningLineType,
    };
  }
}
