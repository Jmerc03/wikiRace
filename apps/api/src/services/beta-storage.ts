import type { Prisma } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { BetaConfig } from "../config/beta.js";
import { prisma } from "../db/prisma.js";
import { GameError } from "../game-errors.js";

export async function requireGameCapacity(tx: Prisma.TransactionClient, config?: BetaConfig) {
  if (!config) return;
  // Serializes fresh and rematch creation; recovered memberships bypass this.
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(687412903)`;
  if (await tx.game.count() >= config.maxGames) throw new GameError(503, "The beta is at its saved-game limit. Please try again later.");
}

export async function requirePlayerCapacity(tx: Prisma.TransactionClient, gameId: string, config?: BetaConfig) {
  if (config && await tx.player.count({ where: { gameId } }) >= 64) throw new GameError(409, "This beta lobby has reached its lifetime membership limit. Open a new game.");
}

export async function pruneFinishedGames(config: BetaConfig, now = new Date()) {
  const before = new Date(now.getTime() - config.retentionDays * 86400000);
  // Never delete WAITING/ACTIVE games. Cascades remove their associated data;
  // surviving rematches lose only their link to the expired previous results.
  return prisma.$transaction(async tx => {
    const due = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Game"
      WHERE "status" = 'FINISHED' AND "finishedAt" < (${before}::timestamptz AT TIME ZONE 'UTC')
      ORDER BY "finishedAt", "id" LIMIT 100 FOR UPDATE SKIP LOCKED`;
    if (!due.length) return 0;
    const result = await tx.game.deleteMany({ where: { id: { in: due.map(g => g.id) } } });
    return result.count;
  });
}

export function registerBetaRetention(app: FastifyInstance, config: BetaConfig) {
  let timer: ReturnType<typeof setInterval> | undefined;
  let flight: Promise<void> | undefined;
  const sweep = () => flight ??= pruneFinishedGames(config).then(count => {
    if (count) app.log.info({ deletedGames: count }, "Expired beta results removed");
  }).catch(() => { app.log.error("Beta retention failed; retrying on next sweep"); })
    .finally(() => { flight = undefined; });
  app.addHook("onReady", async () => { await sweep(); timer = setInterval(() => { void sweep(); }, 3600000); timer.unref(); });
  app.addHook("onClose", async () => { clearInterval(timer); await flight; });
}
