import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { generateBoard, evaluateSquare, getWinningLineResult } from "@bingo/game-engine";
import type { BoardSquare } from "@bingo/shared";
import { prisma } from "../db/prisma.js";
import { GameError } from "../game-errors.js";
import { createPlayerSession, requirePlayer } from "../services/game-auth.js";
import { buildGameState, gameInclude } from "../services/game-state.js";
import { mutateGame } from "../services/game-mutations.js";
import { getLockoutWinningOwnerResult } from "./games.helpers.js";

const PLAYER_COLORS = ["rgba(255,107,107,0.35)", "rgba(77,171,247,0.35)", "rgba(81,207,102,0.35)", "rgba(252,196,25,0.35)", "rgba(177,151,252,0.35)", "rgba(255,146,43,0.35)"];
const TEAM_COLORS = ["rgba(224,49,49,0.35)", "rgba(25,113,194,0.35)", "rgba(47,158,68,0.35)", "rgba(240,140,0,0.35)", "rgba(103,65,217,0.35)", "rgba(194,37,92,0.35)"];
const displayName = z.string().trim().min(1).max(40);
const boardConfigSchema = z.object({
  difficulty: z.enum(["EASY", "MIXED", "HARD"]).default("MIXED"),
  vitalArticleTileCount: z.number().int().min(0).max(25).default(15),
  genericTileCount: z.number().int().min(0).max(25).default(10),
  maxTilesPerTopic: z.number().int().min(1).max(25).default(3),
}).refine(value => value.vitalArticleTileCount + value.genericTileCount === 25, "Board tile counts must add up to 25");
const createGameSchema = z.object({
  mode: z.enum(["NORMAL", "LOCKOUT"]).default("NORMAL"),
  displayName: displayName.default("Player 1"),
  boardConfig: boardConfigSchema.default({ difficulty:"MIXED", vitalArticleTileCount:15, genericTileCount:10, maxTilesPerTopic:3 }),
});
const playerBody = z.object({ playerId: z.uuid() });
const gameParams = z.object({ gameId: z.uuid() });
const teamParams = gameParams.extend({ teamId: z.uuid() });

export function isWikipediaArticle(value: string) {
  try {
    const url = new URL(value);
    if (url.origin !== "https://en.wikipedia.org" || url.username || url.password || !url.pathname.startsWith("/wiki/")) return false;
    const title = decodeURIComponent(url.pathname.slice(6)).replaceAll("_", " ");
    return title.trim().length > 0 && title !== "Main Page" && !/^(?:Special|Talk|User(?: talk)?|Wikipedia(?: talk)?|File(?: talk)?|Media|MediaWiki(?: talk)?|Template(?: talk)?|Help(?: talk)?|Category(?: talk)?|Portal(?: talk)?|Draft(?: talk)?|Module(?: talk)?|TimedText|Book):/i.test(title);
  } catch { return false; }
}
const pageVisitSchema = playerBody.extend({
  url: z.string().max(2048).url().refine(isWikipediaArticle, "Only English Wikipedia article pages count"),
  title: z.string().trim().min(1).max(512),
  categories: z.array(z.string().max(512)).max(500).default([]),
  links: z.array(z.string().max(2048)).max(5000).default([]),
});

async function readableState(gameId: string, playerId: string | null) {
  return prisma.$transaction(tx => buildGameState(tx, gameId, playerId), { isolationLevel: "RepeatableRead" });
}

export async function gameRoutes(app: FastifyInstance) {
  app.post("/", async (request, reply) => {
    const body = createGameSchema.parse(request.body ?? {});
    const board = generateBoard(body.boardConfig);
    const session = createPlayerSession();
    const playerId = randomUUID();
    const state = await prisma.$transaction(async tx => {
      const game = await tx.game.create({ data: {
        mode: body.mode, status: "ACTIVE", startedAt: new Date(), hostPlayerId: playerId,
        boardConfig: body.boardConfig,
        board: { create: { size: board.size, squares: { create: board.squares.map(square => ({
          position: square.position, type: square.type, label: square.label,
          condition: square.condition as Prisma.InputJsonValue, difficulty: square.difficulty,
        })) } } },
        players: { create: { id: playerId, displayName: body.displayName, color: PLAYER_COLORS[0], sessionTokenHash: session.sessionTokenHash } },
      } });
      return buildGameState(tx, game.id, playerId);
    });
    return reply.code(201).send({ ...state, id: state!.gameId, playerToken: session.playerToken });
  });

  // Database player rows include secret hashes; only public summaries are sent.
  app.get("/:gameId", async request => {
    const { gameId } = gameParams.parse(request.params);
    const state = await readableState(gameId, null);
    if (!state) throw new GameError(404, "Game not found");
    return { ...state, id: gameId };
  });
  app.get("/:gameId/board", async request => {
    const { gameId } = gameParams.parse(request.params);
    const state = await readableState(gameId, null);
    if (!state) throw new GameError(404, "Board not found");
    return state.board;
  });
  app.get("/:gameId/state", async request => {
    const { gameId } = gameParams.parse(request.params);
    const { playerId } = playerBody.parse(request.query);
    return prisma.$transaction(async tx => {
      await requirePlayer(tx, request, gameId, playerId);
      const state = await buildGameState(tx, gameId, playerId);
      if (!state) throw new GameError(404, "Game not found");
      return state;
    }, { isolationLevel: "RepeatableRead" });
  });

  app.post("/:gameId/players", async request => {
    const { gameId } = gameParams.parse(request.params);
    const body = z.object({ displayName: displayName.optional() }).parse(request.body ?? {});
    return mutateGame(gameId, async (tx, touch) => {
      const game = await tx.game.findUniqueOrThrow({ where: { id: gameId }, include: { players: true } });
      if (game.status === "FINISHED") throw new GameError(409, "Game is already finished");
      if (game.players.filter(p => !p.leftAt).length >= 32) throw new GameError(409, "This game is full (32 players)");
      const session = createPlayerSession();
      await touch();
      const player = await tx.player.create({ data: { gameId, displayName: body.displayName ?? `Player ${game.players.length + 1}`,
        color: PLAYER_COLORS[game.players.length % PLAYER_COLORS.length], sessionTokenHash: session.sessionTokenHash } });
      return { ...await buildGameState(tx, gameId, player.id), playerToken: session.playerToken };
    });
  });

  app.post("/:gameId/teams", async request => {
    const { gameId } = gameParams.parse(request.params);
    const body = playerBody.extend({ name: displayName }).parse(request.body);
    return mutateGame(gameId, async (tx, touch) => {
      await requirePlayer(tx, request, gameId, body.playerId);
      const game = await tx.game.findUniqueOrThrow({ where: { id: gameId }, include: { teams: true } });
      if (game.status === "FINISHED") throw new GameError(409, "Game is already finished");
      if (game.teams.length >= 16) throw new GameError(409, "This game already has 16 teams");
      if (game.teams.some(t => t.name.toLocaleLowerCase("en") === body.name.toLocaleLowerCase("en"))) throw new GameError(409, "A team with that name already exists");
      await touch();
      return tx.team.create({ data: { gameId, name: body.name, color: TEAM_COLORS[game.teams.length % TEAM_COLORS.length] } });
    });
  });

  async function changeTeam(request: Parameters<typeof requirePlayer>[1], leaving: boolean) {
    const { gameId } = gameParams.parse(request.params);
    const teamId = leaving ? null : teamParams.parse(request.params).teamId;
    const { playerId } = playerBody.parse(request.body);
    return mutateGame(gameId, async (tx, touch) => {
      const player = await requirePlayer(tx, request, gameId, playerId);
      const game = await tx.game.findUniqueOrThrow({ where: { id: gameId }, include: { players: { orderBy: { joinedAt: "asc" } } } });
      if (game.status === "FINISHED") throw new GameError(409, "Game is already finished");
      if (await tx.squareClaim.count({ where: { gameId, playerId } }) > 0) throw new GameError(409, "Cannot change teams after claiming squares");
      const team = teamId ? await tx.team.findFirst({ where: { id: teamId, gameId } }) : null;
      if (teamId && !team) throw new GameError(404, "Team not found");
      if (leaving && !player.teamId) throw new GameError(409, "Player is not on a team");
      await touch();
      await tx.player.update({ where: { id: playerId }, data: { teamId, color: team?.color ?? PLAYER_COLORS[game.players.findIndex(p=>p.id===playerId) % PLAYER_COLORS.length] } });
      return buildGameState(tx, gameId, playerId);
    });
  }
  app.post("/:gameId/teams/:teamId/join", request => changeTeam(request, false));
  app.post("/:gameId/teams/leave", request => changeTeam(request, true));

  app.post("/:gameId/events/page-visit", async request => {
    const { gameId } = gameParams.parse(request.params);
    const event = pageVisitSchema.parse(request.body);
    return mutateGame(gameId, async (tx, touch) => {
      const player = await requirePlayer(tx, request, gameId, event.playerId);
      const game = await tx.game.findUniqueOrThrow({ where: { id: gameId }, include: gameInclude });
      if (!game.board) throw new GameError(404, "Board not found");
      if (game.status === "FINISHED") return buildGameState(tx, gameId, player.id);
      if (game.status !== "ACTIVE") throw new GameError(409, "The host has not started this game");
      await touch();
      const visit = await tx.pageVisitEvent.create({ data: { gameId, ...event } });
      const matched = game.board.squares.filter(square => evaluateSquare(square as BoardSquare, event));
      let newlyCompleted: typeof matched = [];

      if (game.mode === "LOCKOUT") {
        const existing = await tx.squareClaim.findMany({ where: { gameId } });
        const claimedIds = new Set(existing.map(c => c.squareId));
        newlyCompleted = matched.filter(s => !claimedIds.has(s.id));
        await tx.squareClaim.createMany({ data: newlyCompleted.map(square => ({ gameId, playerId: player.id, squareId: square.id, pageVisitEventId: visit.id })) });
        const claims = await tx.squareClaim.findMany({ where: { gameId }, include: { player: true } });
        const result = getLockoutWinningOwnerResult(claims, game.board.squares);
        if (result) {
          const [kind, id] = result.ownerKey.split(":");
          await tx.game.update({ where: { id: gameId }, data: { status: "FINISHED", finishedAt: new Date(), endReason: "MAJORITY",
            winnerPlayerId: kind === "player" ? id : null, winnerTeamId: kind === "team" ? id : null } });
        }
      } else {
        const existing = await tx.squareCompletion.findMany({ where: { gameId, playerId: player.id } });
        const completedIds = new Set(existing.map(c => c.squareId));
        newlyCompleted = matched.filter(s => !completedIds.has(s.id));
        await tx.squareCompletion.createMany({ data: newlyCompleted.map(square => ({ gameId, playerId: player.id, squareId: square.id, pageVisitEventId: visit.id })) });
        for (const square of newlyCompleted) completedIds.add(square.id);
        const result = getWinningLineResult(game.board.squares.filter(s => completedIds.has(s.id)).map(s => s.position));
        if (result) await tx.game.update({ where: { id: gameId }, data: { status: "FINISHED", finishedAt: new Date(), endReason: "BINGO",
          winnerPlayerId: player.id, winningLine: result.positions } });
      }
      return { ...await buildGameState(tx, gameId, player.id), completedSquares: newlyCompleted };
    });
  });
}
