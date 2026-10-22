-- Existing lobbies require explicit readiness after upgrade. Active/finished
-- matches keep their status, scores, sessions and historical records.
ALTER TABLE "Player" ADD COLUMN "isReady" BOOLEAN NOT NULL DEFAULT false;
