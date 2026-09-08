import type { Board, GameStateResponse } from "@bingo/shared";
export type ConnectionStatus = "offline" | "connecting" | "live" | "reconnecting";
export type ExtensionState = Omit<Partial<GameStateResponse>, "gameId" | "board"> & {
  gameId: string | null; board: Board | null; completedSquareIds: string[];
  pendingAdmission?: { kind: "create" | "join"; displayName?: string; gameId?: string };
  apiOrigin: string; connection: ConnectionStatus; error?: string; invalidSession?: boolean;
};
