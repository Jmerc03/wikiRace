import { createHash } from "node:crypto";
import type { FastifyRequest } from "fastify";
import type { Prisma } from "@prisma/client";
import type { GameStateResponse } from "@bingo/shared";
import { prisma } from "../db/prisma.js";
import { GameError } from "../game-errors.js";
import { broadcastToGame } from "../realtime/game-connections.js";
import { createPlayerSession } from "./game-auth.js";
import { buildGameState } from "./game-state.js";

type AdmissionSession = ReturnType<typeof createPlayerSession> & { admissionRequestHash: string | null };

// Idempotency-Key is a private 256-bit session credential, never a public ID.
// Lock the key before the game to serialize retries across create/join targets.
export async function admitPlayer(
  request: FastifyRequest,
  body: unknown,
  gameId: string | null,
  create: (tx: Prisma.TransactionClient, session: AdmissionSession) => Promise<GameStateResponse | null>,
) {
  const key = request.headers["idempotency-key"];
  if (key !== undefined && (typeof key !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(key))) {
    throw new GameError(400, "Idempotency-Key must be a private 43-character base64url session key");
  }
  const session = createPlayerSession(key);
  const admissionRequestHash = key ? createHash("sha256").update(JSON.stringify({ operation: gameId ? "join" : "create", gameId, body })).digest("hex") : null;
  let created = false;
  const state = await prisma.$transaction(async tx => {
    if (key) {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${session.sessionTokenHash}, 0))`;
      const existing = await tx.player.findUnique({ where: { sessionTokenHash: session.sessionTokenHash } });
      if (existing) {
        if (existing.admissionRequestHash !== admissionRequestHash) throw new GameError(409, "This entry key belongs to a different request");
        await tx.$queryRaw`SELECT "id" FROM "Game" WHERE "id" = ${existing.gameId} FOR UPDATE`;
        // Recheck after the game lock: a leave may have committed while waiting.
        const current = await tx.player.findUniqueOrThrow({ where: { id: existing.id } });
        if (current.leftAt) throw new GameError(409, "This membership has already left the game. Start a new entry.");
        return buildGameState(tx, existing.gameId, existing.id);
      }
    }
    if (gameId) {
      const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Game" WHERE "id" = ${gameId} FOR UPDATE`;
      if (!rows.length) throw new GameError(404, "Game not found");
    }
    const result = await create(tx, { ...session, admissionRequestHash });
    created = true;
    return result;
  }, { maxWait: 10000, timeout: 15000 });
  if (!state) throw new GameError(404, "Game not found");
  if (created && gameId) broadcastToGame(gameId, { type: "GAME_STATE_UPDATED", gameId });
  return { ...state, playerToken: session.playerToken };
}
