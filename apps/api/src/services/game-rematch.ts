import { createHmac, randomUUID } from "node:crypto";
import type { FastifyRequest } from "fastify";
import { Prisma } from "@prisma/client";
import { generateBoard } from "@bingo/game-engine";
import type { BoardGenerationConfig } from "@bingo/shared";
import { GameError } from "../game-errors.js";
import { broadcastToGame } from "../realtime/game-connections.js";
import { createPlayerSession, requirePlayer } from "./game-auth.js";
import { buildGameState, gameInclude } from "./game-state.js";
import { mutateGame } from "./game-mutations.js";
import { expireLockedRound, notifyExpiredRounds } from "./round-timer.js";
import type { BetaConfig } from "../config/beta.js";
import { requireGameCapacity, requirePlayerCapacity } from "./beta-storage.js";

/** Source then destination locks are always acquired in forward round order. */
export async function enterRematch(request: FastifyRequest, sourceGameId: string, sourcePlayerId: string, beta?: BetaConfig) {
  let destinationChanged = false;
  let expired: Awaited<ReturnType<typeof expireLockedRound>> = [];
  const result = await mutateGame(sourceGameId, async (tx, touchSource) => {
    const sourcePlayer = await requirePlayer(tx, request, sourceGameId, sourcePlayerId);
    const source = await tx.game.findUniqueOrThrow({ where: { id: sourceGameId }, include: gameInclude });
    if (source.status !== "FINISHED") throw new GameError(409, "Finish this match before opening a rematch");
    let next = await tx.game.findUnique({ where: { rematchOfGameId: sourceGameId } });
    const creating = !next;
    const playerId = randomUUID();
    if (!next) {
      if (source.hostPlayerId !== sourcePlayerId) throw new GameError(403, "Only the host can open the next lobby");
      await requireGameCapacity(tx, beta);
      const config = source.boardConfig as unknown as BoardGenerationConfig | null;
      const board = generateBoard(config ?? undefined);
      next = await tx.game.create({ data: {
        mode: source.mode, status: "WAITING", hostPlayerId: playerId, rematchOfGameId: source.id,
        boardConfig: source.boardConfig ?? Prisma.JsonNull,
        timeLimitSeconds: source.timeLimitSeconds,
        board: { create: { size: board.size, squares: { create: board.squares.map(square => ({
          position: square.position, type: square.type, label: square.label,
          condition: square.condition as Prisma.InputJsonValue, difficulty: square.difficulty,
        })) } } },
        teams: { create: source.teams.map(team => ({ name: team.name, color: team.color, rematchSourceTeamId: team.id })) },
      } });
      await touchSource();
    } else {
      await tx.$queryRaw`SELECT "id" FROM "Game" WHERE "id" = ${next.id} FOR UPDATE`;
      expired = await expireLockedRound(tx, next.id);
      // The destination could have started or ended while waiting for its lock.
      next = await tx.game.findUniqueOrThrow({ where: { id: next.id } });
    }
    // A distinct credential per round, recoverable using the authenticated old
    // credential. Only hashes persist; no new key can be lost on response loss.
    const oldToken = request.headers.authorization!.slice(7);
    const token = createHmac("sha256", oldToken).update(`wikirace/rematch/v1/${next.id}/${sourcePlayerId}`).digest("base64url");
    const identity = createPlayerSession(token);
    const existing = await tx.player.findUnique({ where: { gameId_rematchSourcePlayerId: { gameId: next.id, rematchSourcePlayerId: sourcePlayerId } } });
    if (existing) {
      if (existing.leftAt) throw new GameError(409, existing.removedByHost ? "The host removed you from this rematch lobby." : "You already left this rematch. Join another lobby explicitly.");
      if (existing.sessionTokenHash !== identity.sessionTokenHash) throw new GameError(409, "This rematch membership cannot be recovered with that session");
      return { ...await buildGameState(tx, next.id, existing.id), playerToken: identity.playerToken };
    }
    if (next.status !== "WAITING") throw new GameError(409, "The rematch has already started or finished. Ask the host for the next invitation.");
    if (next.isJoinLocked) throw new GameError(409, "Joining is locked. Ask the host to reopen joining.");
    if (await tx.player.count({ where: { gameId: next.id, leftAt: null } }) >= 32) throw new GameError(409, "This game is full (32 players)");
    await requirePlayerCapacity(tx, next.id, beta);
    const team = sourcePlayer.teamId ? await tx.team.findUnique({ where: { gameId_rematchSourceTeamId: { gameId: next.id, rematchSourceTeamId: sourcePlayer.teamId } } }) : null;
    await tx.player.create({ data: {
      id: playerId, gameId: next.id, displayName: sourcePlayer.displayName, color: sourcePlayer.color,
      teamId: team?.id ?? null, sessionTokenHash: identity.sessionTokenHash, rematchSourcePlayerId: sourcePlayer.id,
    } });
    if (!creating) await tx.game.update({ where: { id: next.id }, data: { revision: { increment: 1 } } });
    destinationChanged = true;
    return { ...await buildGameState(tx, next.id, playerId), playerToken: identity.playerToken };
  });
  if (destinationChanged && result.gameId) broadcastToGame(result.gameId, { type: "GAME_STATE_UPDATED", gameId: result.gameId });
  notifyExpiredRounds(expired);
  return result;
}
