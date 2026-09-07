-- Additive migration. Preserve existing games, players, visits and claims.
ALTER TABLE "Game"
  ADD COLUMN "hostPlayerId" TEXT,
  ADD COLUMN "winnerPlayerId" TEXT,
  ADD COLUMN "winnerTeamId" TEXT,
  ADD COLUMN "winningLine" JSONB,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "finishedAt" TIMESTAMP(3),
  ADD COLUMN "endReason" TEXT,
  ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Player" ADD COLUMN "sessionTokenHash" TEXT, ADD COLUMN "leftAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Player_sessionTokenHash_key" ON "Player"("sessionTokenHash");
CREATE INDEX "Player_gameId_joinedAt_idx" ON "Player"("gameId", "joinedAt");
CREATE INDEX "PageVisitEvent_gameId_playerId_idx" ON "PageVisitEvent"("gameId", "playerId");
CREATE INDEX "SquareCompletion_gameId_playerId_idx" ON "SquareCompletion"("gameId", "playerId");
UPDATE "Game" AS g SET "hostPlayerId" = (
  SELECT p.id FROM "Player" AS p WHERE p."gameId" = g.id ORDER BY p."joinedAt", p.id LIMIT 1
);
-- Legacy tokenless players remain historical records. Tokens cannot be safely
-- recovered from public player IDs; clients must explicitly join a new session.
