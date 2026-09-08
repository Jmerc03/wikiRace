-- Nullable metadata preserves every existing player/session and historical row.
-- New clients bind a private retry key to the exact create/join request.
ALTER TABLE "Player" ADD COLUMN "admissionRequestHash" TEXT;
