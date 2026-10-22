import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { Prisma } from "@prisma/client";
import { GameError } from "../game-errors.js";

export function createPlayerSession(playerToken = randomBytes(32).toString("base64url")) {
  return { playerToken, sessionTokenHash: hashToken(playerToken) };
}
function hashToken(token: string) { return createHash("sha256").update(token).digest("hex"); }

export async function requirePlayer(db: Prisma.TransactionClient, request: FastifyRequest, gameId: string, playerId: string, allowLeft = false) {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  return requirePlayerToken(db, token, gameId, playerId, allowLeft);
}

export async function requirePlayerToken(db: Prisma.TransactionClient, token: string, gameId: string, playerId: string, allowLeft = false) {
  if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new GameError(401, "A valid player session is required");
  const player = await db.player.findFirst({ where: { id: playerId, gameId } });
  if (!player?.sessionTokenHash || !timingSafeEqual(Buffer.from(player.sessionTokenHash), Buffer.from(hashToken(token)))) {
    throw new GameError(401, "This player session is invalid or has left the game");
  }
  if (!allowLeft && player.leftAt) throw new GameError(401, player.removedByHost
    ? "The host removed you from the lobby. Forget this session to join another game."
    : "This player session is invalid or has left the game");
  return player;
}
