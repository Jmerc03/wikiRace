import type { FastifyInstance } from "fastify";
import type { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { broadcastToGame } from "../realtime/game-connections.js";

type ExpiredRound = { id: string; rematchOfGameId: string | null };

/** Caller already holds this game's row lock. Sample time after that lock. */
export function expireLockedRound(tx: Prisma.TransactionClient, gameId: string): Promise<ExpiredRound[]> {
  const now = new Date();
  // Prisma DateTime columns are UTC timestamp-without-time-zone; bind dates
  // arrive as timestamptz, so avoid the database session timezone conversion.
  return tx.$queryRaw<ExpiredRound[]>`UPDATE "Game" SET "status" = 'FINISHED',
    "finishedAt" = "expiresAt", "endReason" = 'TIME_LIMIT', "revision" = "revision" + 1
    WHERE "id" = ${gameId} AND "status" = 'ACTIVE' AND "expiresAt" <= (${now}::timestamptz AT TIME ZONE 'UTC')
    RETURNING "id", "rematchOfGameId"`;
}

export function notifyExpiredRounds(rounds: ExpiredRound[]) {
  const ids = new Set(rounds.flatMap(round => round.rematchOfGameId ? [round.id, round.rematchOfGameId] : [round.id]));
  for (const gameId of ids) broadcastToGame(gameId, { type: "GAME_STATE_UPDATED", gameId });
}

export async function expireDueRounds() {
  const now = new Date();
  // One statement commits before notifications. Skip games currently processing
  // another operation; their mutation guard or a later sweep will finish them.
  const expired = await prisma.$queryRaw<ExpiredRound[]>`WITH due AS (
    SELECT "id" FROM "Game" WHERE "status" = 'ACTIVE' AND "expiresAt" <= (${now}::timestamptz AT TIME ZONE 'UTC')
    ORDER BY "expiresAt", "id" LIMIT 100 FOR UPDATE SKIP LOCKED
  ) UPDATE "Game" g SET "status" = 'FINISHED', "finishedAt" = g."expiresAt",
    "endReason" = 'TIME_LIMIT', "revision" = g."revision" + 1
    FROM due WHERE g."id" = due."id" RETURNING g."id", g."rematchOfGameId"`;
  notifyExpiredRounds(expired);
  return expired.length;
}

export function registerRoundTimer(app: FastifyInstance) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let flight: Promise<void> | undefined;
  const sweep = () => {
    if (!flight) flight = expireDueRounds().then(() => {}).catch(error => app.log.error(error, "Round timer sweep failed; retrying"))
      .finally(() => { flight = undefined; });
    return flight;
  };
  app.addHook("onReady", async () => { await sweep(); timer = setInterval(() => { void sweep(); }, 1000); timer.unref(); });
  app.addHook("onClose", async () => { clearInterval(timer); await flight; });
}
