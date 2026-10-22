import type { Board, BoardGenerationConfig, GameMode, GameStatus } from "./types.js";

export interface PlayerSummary {
  id: string; displayName: string; color: string | null; teamId: string | null;
  leftAt?: string | null; isHost?: boolean; score?: number; isReady: boolean; removedByHost: boolean;
}
export interface TeamSummary {
  id: string; name: string; color: string;
  players: { id: string; displayName: string; color: string | null }[];
}
export interface WinningOwner {
  ownerKey: string; type: "TEAM" | "PLAYER"; id: string; name: string; color: string | null;
}
export interface SquareClaim {
  squareId: string; playerId: string; playerName: string; playerColor: string | null;
  teamId: string | null; teamName: string | null; teamColor: string | null; claimedAt: string;
}
export interface SquareEvidence {
  squareId: string; playerId: string; playerName: string;
  title: string; url: string | null; earnedAt: string;
}
export interface GameStateResponse {
  gameId: string; playerId: string | null; playerName: string | null;
  mode: GameMode; status: GameStatus; revision: number;
  isJoinLocked: boolean;
  timeLimitSeconds: number | null; expiresAt: string | null;
  board: Board; boardConfig: BoardGenerationConfig | null;
  hostPlayerId: string | null; startedAt: string | null; finishedAt: string | null; endReason: string | null;
  playerCount: number; players: PlayerSummary[]; teams: TeamSummary[];
  completedSquareIds: string[]; squareClaims: SquareClaim[];
  squareEvidence: SquareEvidence[];
  previousGameId: string | null; rematchGameId: string | null; rematchStatus: GameStatus | null;
  rematchJoinLocked: boolean | null;
  winner: boolean; winningOwner: WinningOwner | null; winningLine: number[] | null;
  winningLineType: "ROW" | "COLUMN" | "DIAGONAL" | null;
}
export interface PlayerSessionResponse extends GameStateResponse { playerToken: string; }
