-- CreateTable
CREATE TABLE "SquareClaim" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "squareId" TEXT NOT NULL,
    "pageVisitEventId" TEXT NOT NULL,
    "claimedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquareClaim_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SquareClaim_gameId_squareId_key" ON "SquareClaim"("gameId", "squareId");

-- AddForeignKey
ALTER TABLE "SquareClaim" ADD CONSTRAINT "SquareClaim_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquareClaim" ADD CONSTRAINT "SquareClaim_squareId_fkey" FOREIGN KEY ("squareId") REFERENCES "BoardSquare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquareClaim" ADD CONSTRAINT "SquareClaim_pageVisitEventId_fkey" FOREIGN KEY ("pageVisitEventId") REFERENCES "PageVisitEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
