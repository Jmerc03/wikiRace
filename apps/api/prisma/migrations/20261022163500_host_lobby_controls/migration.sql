-- Preserve existing admission behavior and historical membership records.
ALTER TABLE "Game" ADD COLUMN "isJoinLocked" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Player" ADD COLUMN "removedByHost" BOOLEAN NOT NULL DEFAULT false;
