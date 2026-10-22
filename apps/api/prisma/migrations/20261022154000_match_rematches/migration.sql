-- Nullable, additive provenance preserves existing games, identities and scores.
ALTER TABLE "Game" ADD COLUMN "rematchOfGameId" TEXT;
ALTER TABLE "Player" ADD COLUMN "rematchSourcePlayerId" TEXT;
ALTER TABLE "Team" ADD COLUMN "rematchSourceTeamId" TEXT;
CREATE UNIQUE INDEX "Game_rematchOfGameId_key" ON "Game"("rematchOfGameId");
CREATE UNIQUE INDEX "Player_gameId_rematchSourcePlayerId_key" ON "Player"("gameId", "rematchSourcePlayerId");
CREATE UNIQUE INDEX "Team_gameId_rematchSourceTeamId_key" ON "Team"("gameId", "rematchSourceTeamId");
ALTER TABLE "Game" ADD CONSTRAINT "Game_rematchOfGameId_fkey" FOREIGN KEY ("rematchOfGameId") REFERENCES "Game"("id") ON DELETE SET NULL ON UPDATE CASCADE;
