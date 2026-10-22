import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { broadcastToGame } from "../realtime/game-connections.js";
import { GameError } from "../game-errors.js";
import { expireLockedRound, notifyExpiredRounds } from "./round-timer.js";

export async function mutateGame<T>(gameId: string, action: (tx: Prisma.TransactionClient, touch: () => Promise<void>) => Promise<T>): Promise<T> {
  let changed = false;
  let parentToNotify: string | null = null;
  const result = await prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<{id:string; status:string; isJoinLocked:boolean; rematchOfGameId:string|null}[]>`SELECT "id", "status", "isJoinLocked", "rematchOfGameId" FROM "Game" WHERE "id" = ${gameId} FOR UPDATE`;
    if (!rows.length) throw new GameError(404, "Game not found");
    const expired = await expireLockedRound(tx, gameId);
    if (expired.length) return { expired, value: undefined };
    const value = await action(tx, async () => {
      if (changed) return;
      await tx.game.update({ where: { id: gameId }, data: { revision: { increment: 1 } } });
      changed = true;
    });
    if (changed && rows[0].rematchOfGameId) {
      const current = await tx.game.findUniqueOrThrow({ where: { id: gameId }, select: { status: true, isJoinLocked: true } });
      if (current.status !== rows[0].status || current.isJoinLocked !== rows[0].isJoinLocked) parentToNotify = rows[0].rematchOfGameId;
    }
    return { expired: null, value };
  }, { maxWait: 10000, timeout: 15000 });
  // Each client refetches its own view. Sending the actor's Normal progress to
  // everyone would replace every other player's independent board progress.
  if (changed) broadcastToGame(gameId, { type: "GAME_STATE_UPDATED", gameId });
  if (parentToNotify) broadcastToGame(parentToNotify, { type: "GAME_STATE_UPDATED", gameId: parentToNotify });
  if (result.expired) {
    // Commit expiry independently of a later validation error. Re-enter once
    // against FINISHED state: leave/recovery work, scoring writes nothing.
    notifyExpiredRounds(result.expired);
    return mutateGame(gameId, action);
  }
  return result.value as T;
}
