import { Prisma } from "@prisma/client";
import { getWinningLineResult } from "@bingo/game-engine";
import { buildPlayerSummaries, buildTeamSummaries, buildSquareClaimSummaries } from "../routes/games.helpers.js";

export const gameInclude = {
  board: { include: { squares: { orderBy: { position: "asc" as const } } } },
  players: { orderBy: [{ joinedAt: "asc" as const }, { id: "asc" as const }] },
  teams: { orderBy: [{ createdAt: "asc" as const }, { id: "asc" as const }] },
} satisfies Prisma.GameInclude;

export async function buildGameState(db: Prisma.TransactionClient, gameId: string, playerId: string | null) {
  const game = await db.game.findUnique({ where: { id: gameId }, include: gameInclude });
  if (!game?.board) return null;
  const claims = game.mode === "LOCKOUT" ? await db.squareClaim.findMany({
    where: { gameId }, include: { player: true }, orderBy: { claimedAt: "asc" },
  }) : [];
  const completions = game.mode === "NORMAL" ? await db.squareCompletion.findMany({
    where: { gameId }, orderBy: { completedAt: "asc" },
  }) : [];
  const players = buildPlayerSummaries(game.players).map((player, index) => ({ ...player,
    leftAt: game.players[index].leftAt,
    isHost: player.id === game.hostPlayerId,
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
    mode: game.mode, status: game.status, revision: game.revision,
    boardConfig: game.boardConfig, board: game.board, hostPlayerId: game.hostPlayerId,
    startedAt: game.startedAt, finishedAt: game.finishedAt, endReason: game.endReason,
    playerCount: activePlayers.length, players,
    teams: buildTeamSummaries(game.teams, activePlayers),
    completedSquareIds: game.mode === "LOCKOUT" ? claims.map(c => c.squareId) : completions.filter(c=>c.playerId === playerId).map(c=>c.squareId),
    squareClaims: buildSquareClaimSummaries(claims, game.teams),
    winner: winningOwner !== null, winningOwner, winningLine,
    winningLineType: winningLine ? getWinningLineResult(winningLine)?.type ?? null : null,
  };
}
