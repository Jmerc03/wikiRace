import type { GameStateResponse } from "./api.js";

type ScoreState = Pick<GameStateResponse, "mode" | "players" | "teams" | "squareClaims" | "winningOwner">;
export interface MatchStanding {
  id: string; name: string; color: string | null; score: number;
  detail: string; isWinner: boolean; rank: number;
}

/** Final winner comes from the stored outcome, never from the score ordering. */
export function matchStandings(state: ScoreState): MatchStanding[] {
  const entries = state.mode === "NORMAL"
    ? state.players.map(p => ({ id: p.id, name: p.displayName, color: p.color, score: p.score ?? 0,
      detail: p.removedByHost ? "Removed in lobby" : p.leftAt ? "Left match" : "Player", isWinner: state.winningOwner?.ownerKey === `player:${p.id}` }))
    : [
      ...state.teams.filter(t => state.players.some(p => p.teamId === t.id) || state.squareClaims.some(c => c.teamId === t.id)).map(t => ({
        id: t.id, name: t.name, color: t.color, score: state.squareClaims.filter(c => c.teamId === t.id).length,
        detail: `Team · ${state.players.filter(p => p.teamId === t.id).length} members`,
        isWinner: state.winningOwner?.ownerKey === `team:${t.id}`,
      })),
      ...state.players.filter(p => !p.teamId).map(p => ({ id: p.id, name: p.displayName, color: p.color,
        score: state.squareClaims.filter(c => c.playerId === p.id).length,
        detail: p.removedByHost ? "Removed in lobby" : p.leftAt ? "Left match" : "Solo player", isWinner: state.winningOwner?.ownerKey === `player:${p.id}` })),
    ];
  entries.sort((a, b) => Number(b.isWinner) - Number(a.isWinner) || b.score - a.score || a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  let rank = 0;
  return entries.map((entry, index) => {
    const previous = entries[index - 1];
    if (!previous || previous.score !== entry.score || previous.isWinner !== entry.isWinner) rank = index + 1;
    return { ...entry, rank };
  });
}

export function matchDuration(state: Pick<GameStateResponse, "startedAt" | "finishedAt">): number | null {
  if (!state.startedAt || !state.finishedAt) return null;
  const elapsed = Date.parse(state.finishedAt) - Date.parse(state.startedAt);
  return Number.isFinite(elapsed) && elapsed >= 0 ? elapsed : null;
}

export function formatDuration(milliseconds: number | null): string {
  if (milliseconds === null || !Number.isFinite(milliseconds) || milliseconds < 0) return "Unavailable";
  const seconds = Math.floor(milliseconds / 1000);
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor(seconds / 60) % 60;
  return `${hours ? `${hours}h ` : ""}${minutes}m ${String(seconds % 60).padStart(2, "0")}s`;
}

export function matchOutcome(state: Pick<GameStateResponse, "mode" | "winningOwner" | "endReason">): string {
  if (state.winningOwner) return `${state.winningOwner.name} won by ${state.mode === "NORMAL" ? "bingo" : "majority"}`;
  if (state.endReason === "BOARD_EXHAUSTED") return "Draw — no owner reached 13 squares";
  if (state.endReason === "TIME_LIMIT") return "Time’s up — no winner";
  if (state.endReason === "LEGACY_UNKNOWN") return "Historical result unavailable";
  if (state.endReason === "EMPTY") return "Match ended — everyone left";
  return "Match ended without a winner";
}
