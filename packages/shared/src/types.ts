export type GameMode = "NORMAL" | "LOCKOUT";

export type GameStatus = "WAITING" | "ACTIVE" | "FINISHED";

export type SquareType =
  | "TITLE_CONTAINS"
  | "TITLE_STARTS_WITH"
  | "CATEGORY_CONTAINS"
  | "LINK_COUNT_GREATER_THAN"
  | "VISIT_ARTICLE";

export type Difficulty = "EASY" | "MEDIUM" | "HARD";

export interface BoardSquare {
  id: string;
  position: number;
  type: SquareType;
  label: string;
  condition: Record<string, unknown>;
  difficulty: Difficulty;
}

export interface Board {
  id: string;
  size: number;
  squares: BoardSquare[];
}

export type BoardDifficulty = "EASY" | "MIXED" | "HARD";

export interface BoardGenerationConfig {
  difficulty: BoardDifficulty;
  vitalArticleTileCount: number;
  genericTileCount: number;
  maxTilesPerTopic: number;
}

export interface Game {
  id: string;
  mode: GameMode;
  status: GameStatus;
  board: Board;
  createdAt: string;
}

export interface PageVisitEvent {
  playerId: string;
  url: string;
  title: string;
  categories: string[];
  links: string[];
}
