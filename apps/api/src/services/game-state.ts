import { Prisma } from "@prisma/client";
import { getWinningLineResult } from "@bingo/game-engine";
import { isArticleUrl, type GameStateResponse, type BoardGenerationConfig } from "@bingo/shared";
import { buildPlayerSummaries, buildTeamSummaries, buildSquareClaimSummaries } from "../routes/games.helpers.js";

export const gameInclude = {
  rematch: { select: { id: true, status: true, isJoinLocked: true } },
  board: { include: { squares: { orderBy: { position: "asc" as const } } } },
  players: { orderBy: [{ joinedAt: "asc" as const }, { id: "asc" as const }] },
  teams: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
} satisfies Prisma.GameInclude;

export async function buildGameState(db: Prisma.TransactionClient, gameId: string, playerId: string | null): Promise<GameStateResponse | null> {
  const game = await db.game.findUnique({ where: { id: gameId }, include: gameInclude });
  if (!game?.board) return null;
  const claims = game.mode === "LOCKOUT" ? await db.squareClaim.findMany({
    where: { gameId }, include: { player: true, pageVisitEvent: { select: { title: true, url: true } } }, orderBy: [{ claimedAt: "asc" }, { squareId: "asc" }],
  }) : [];
  const completions = game.mode === "NORMAL" ? await db.squareCompletion.findMany({
    where: { gameId }, orderBy: { completedAt: "asc" },
  }) : [];
  // Only earning visits for the selected Normal player are serialized. Never
  // fetch or return unrelated browsing events, categories, links or credentials.
  const ownEvidence = game.mode === "NORMAL" && playerId ? await db.squareCompletion.findMany({
    where: { gameId, playerId }, include: { pageVisitEvent: { select: { title: true, url: true } } },
    orderBy: [{ completedAt: "asc" }, { squareId: "asc" }],
  }) : [];
  const squareEvidence = game.mode === "LOCKOUT" ? claims.map(c => ({
    squareId: c.squareId, playerId: c.playerId, playerName: c.player.displayName,
    title: c.pageVisitEvent.title, url: isArticleUrl(c.pageVisitEvent.url) ? c.pageVisitEvent.url : null, earnedAt: c.claimedAt.toISOString(),
  })) : ownEvidence.map(c => ({
    squareId: c.squareId, playerId: c.playerId, playerName: game.players.find(p => p.id === c.playerId)?.displayName ?? "Player",
    title: c.pageVisitEvent.title, url: isArticleUrl(c.pageVisitEvent.url) ? c.pageVisitEvent.url : null, earnedAt: c.completedAt.toISOString(),
  }));
  const players = buildPlayerSummaries(game.players).map((player, index) => ({ ...player,
    leftAt: game.players[index].leftAt?.toISOString() ?? null,
    isHost: player.id === game.hostPlayerId,
    isReady: game.players[index].isReady,
    removedByHost: game.players[index].removedByHost,
    score: game.mode === "NORMAL"
      ? completions.filter(c => c.playerId === player.id).length
      : claims.filter(c => c.playerId === player.id).length,
  }));
  const activePlayers = game.players.filter(p => !p.leftAt);
  const winnerPlayer = game.players.find(p => p.id === game.winnerPlayerId);
  const winnerTeam = game.teams.find(t => t.id === game.winnerTeamId);
  const winningOwner = winnerTeam ? {
    ownerKey: `team:${winnerTeam.id}`, type: "TEAM" as const, id: winnerTeam.id, name: winnerTeam.name, color: winnerTeam.color,
  } : winnerPlayer ? {
    ownerKey: `player:${winnerPlayer.id}`, type: "PLAYER" as const, id: winnerPlayer.id, name: winnerPlayer.displayName, color: winnerPlayer.color,
  } : null;
  const winningLine = Array.isArray(game.winningLine) ? game.winningLine as number[] : null;
  return {
    gameId, playerId, playerName: players.find(p => p.id === playerId)?.displayName ?? null,
    mode: game.mode, status: game.status, revision: game.revision, isJoinLocked: game.isJoinLocked,
    boardConfig: game.boardConfig as unknown as BoardGenerationConfig | null,
    timeLimitSeconds: game.timeLimitSeconds, expiresAt: game.expiresAt?.toISOString() ?? null,
    board: { ...game.board, squares: game.board.squares.map(square => ({ ...square, condition: square.condition as Record<string, unknown> })) },
    hostPlayerId: game.hostPlayerId,
    startedAt: game.startedAt?.toISOString() ?? null, finishedAt: game.finishedAt?.toISOString() ?? null, endReason: game.endReason,
    playerCount: activePlayers.length, players,
    teams: buildTeamSummaries(game.teams, activePlayers),
    completedSquareIds: game.mode === "LOCKOUT" ? claims.map(c => c.squareId) : completions.filter(c=>c.playerId === playerId).map(c=>c.squareId),
    squareClaims: buildSquareClaimSummaries(claims, game.teams).map(claim => ({ ...claim, claimedAt: claim.claimedAt.toISOString() })),
    squareEvidence,
    previousGameId: game.rematchOfGameId, rematchGameId: game.rematch?.id ?? null, rematchStatus: game.rematch?.status ?? null, rematchJoinLocked: game.rematch?.isJoinLocked ?? null,
    winner: winningOwner !== null, winningOwner, winningLine,
    winningLineType: winningLine ? getWinningLineResult(winningLine)?.type ?? null : null,
  };
}
