-- CreateEnum
CREATE TYPE "GameMode" AS ENUM ('NORMAL', 'LOCKOUT');

-- CreateEnum
CREATE TYPE "GameStatus" AS ENUM ('WAITING', 'ACTIVE', 'FINISHED');

-- CreateEnum
CREATE TYPE "SquareType" AS ENUM ('TITLE_CONTAINS', 'TITLE_STARTS_WITH', 'CATEGORY_CONTAINS', 'LINK_COUNT_GREATER_THAN');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('EASY', 'MEDIUM', 'HARD');

-- CreateTable
CREATE TABLE "Game" (
    "id" TEXT NOT NULL,
    "mode" "GameMode" NOT NULL,
    "status" "GameStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Game_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Player" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Player_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Board" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "size" INTEGER NOT NULL DEFAULT 5,

    CONSTRAINT "Board_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BoardSquare" (
    "id" TEXT NOT NULL,
    "boardId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "type" "SquareType" NOT NULL,
    "label" TEXT NOT NULL,
    "condition" JSONB NOT NULL,
    "difficulty" "Difficulty" NOT NULL,

    CONSTRAINT "BoardSquare_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PageVisitEvent" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categories" JSONB NOT NULL,
    "links" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PageVisitEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SquareCompletion" (
    "id" TEXT NOT NULL,
    "gameId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "squareId" TEXT NOT NULL,
    "pageVisitEventId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SquareCompletion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Board_gameId_key" ON "Board"("gameId");

-- CreateIndex
CREATE UNIQUE INDEX "BoardSquare_boardId_position_key" ON "BoardSquare"("boardId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "SquareCompletion_playerId_squareId_key" ON "SquareCompletion"("playerId", "squareId");

-- AddForeignKey
ALTER TABLE "Player" ADD CONSTRAINT "Player_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Board" ADD CONSTRAINT "Board_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BoardSquare" ADD CONSTRAINT "BoardSquare_boardId_fkey" FOREIGN KEY ("boardId") REFERENCES "Board"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageVisitEvent" ADD CONSTRAINT "PageVisitEvent_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PageVisitEvent" ADD CONSTRAINT "PageVisitEvent_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquareCompletion" ADD CONSTRAINT "SquareCompletion_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquareCompletion" ADD CONSTRAINT "SquareCompletion_squareId_fkey" FOREIGN KEY ("squareId") REFERENCES "BoardSquare"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SquareCompletion" ADD CONSTRAINT "SquareCompletion_pageVisitEventId_fkey" FOREIGN KEY ("pageVisitEventId") REFERENCES "PageVisitEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
