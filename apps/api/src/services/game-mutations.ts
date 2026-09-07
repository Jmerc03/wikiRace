import { Prisma } from "@prisma/client";
import { prisma } from "../db/prisma.js";
import { broadcastToGame } from "../realtime/game-connections.js";
import { GameError } from "../game-errors.js";

export async function mutateGame<T>(gameId: string, action: (tx: Prisma.TransactionClient, touch: () => Promise<void>) => Promise<T>): Promise<T> {
  let changed = false;
  const result = await prisma.$transaction(async tx => {
    const rows = await tx.$queryRaw<{id:string}[]>`SELECT "id" FROM "Game" WHERE "id" = ${gameId} FOR UPDATE`;
    if (!rows.length) throw new GameError(404, "Game not found");
    return action(tx, async () => {
      if (changed) return;
      await tx.game.update({ where: { id: gameId }, data: { revision: { increment: 1 } } });
      changed = true;
    });
  }, { maxWait: 10000, timeout: 15000 });
  // Each client refetches its own view. Sending the actor's Normal progress to
  // everyone would replace every other player's independent board progress.
  if (changed) broadcastToGame(gameId, { type: "GAME_STATE_UPDATED", gameId });
  return result;
}
