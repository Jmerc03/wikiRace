-- Tokenless prototype sessions cannot authenticate after the session upgrade.
-- Retire their membership without deleting visits, claims, teams or names.
-- leftAt is the retirement time, not an inferred historical departure time.
UPDATE "Player" SET "leftAt" = CURRENT_TIMESTAMP
WHERE "sessionTokenHash" IS NULL AND "leftAt" IS NULL;

-- Keep resumable waiting/active games. The next authenticated join takes an
-- empty host slot; valid current host ownership is preserved.
UPDATE "Game" AS g SET "hostPlayerId" = (
  SELECT p.id FROM "Player" p
  WHERE p."gameId" = g.id AND p."leftAt" IS NULL AND p."sessionTokenHash" IS NOT NULL
  ORDER BY p."joinedAt", p.id LIMIT 1
)
WHERE g."hostPlayerId" IS NULL OR NOT EXISTS (
  SELECT 1 FROM "Player" p WHERE p.id = g."hostPlayerId" AND p."gameId" = g.id
  AND p."leftAt" IS NULL AND p."sessionTokenHash" IS NOT NULL
);

-- Old finished matches did not store a global winner. Missing evidence must
-- not be presented as a host ending the game or an invented winner.
UPDATE "Game" SET "endReason" = 'LEGACY_UNKNOWN'
WHERE status = 'FINISHED' AND "endReason" IS NULL
AND "winnerPlayerId" IS NULL AND "winnerTeamId" IS NULL;
