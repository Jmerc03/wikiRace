ALTER TABLE "Game" ADD COLUMN "timeLimitSeconds" INTEGER;
ALTER TABLE "Game" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "Game" ADD CONSTRAINT "Game_timeLimitSeconds_check"
  CHECK ("timeLimitSeconds" IS NULL OR "timeLimitSeconds" BETWEEN 60 AND 7200);
CREATE INDEX "Game_status_expiresAt_idx" ON "Game"("status", "expiresAt");
