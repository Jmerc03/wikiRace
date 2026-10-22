import type { BoardDifficulty, BoardGenerationConfig } from "./types.js";

export const DEFAULT_BOARD_CONFIG: Readonly<BoardGenerationConfig> = Object.freeze({
  difficulty: "MIXED", vitalArticleTileCount: 15, genericTileCount: 10, maxTilesPerTopic: 3,
});

/** Entry index is the per-topic cap minus one; counts are capped at 25. */
export interface BoardSetupOptions {
  articleCapacities: Record<BoardDifficulty, number[]>;
}

export function boardSetupIssue(config: BoardGenerationConfig, options: BoardSetupOptions): string | null {
  if (![config.vitalArticleTileCount, config.genericTileCount].every(n => Number.isInteger(n) && n >= 0 && n <= 25)
      || config.vitalArticleTileCount + config.genericTileCount !== 25) return "Choose a mix of exactly 25 squares.";
  if (!Number.isInteger(config.maxTilesPerTopic) || config.maxTilesPerTopic < 1 || config.maxTilesPerTopic > 25)
    return "Choose a topic limit from 1 to 25.";
  const capacity = options.articleCapacities[config.difficulty]?.[config.maxTilesPerTopic - 1];
  if (!Number.isInteger(capacity) || capacity < 0 || capacity > 25) return "Board options are unavailable. Reload them before creating a lobby.";
  if (config.vitalArticleTileCount > capacity)
    return `This topic limit supports up to ${capacity} named articles at this difficulty. Choose fewer named articles or allow more per topic.`;
  return null;
}

export function boardConfigSummary(config: BoardGenerationConfig | null | undefined): string {
  if (!config) return "Board settings unavailable for this older match.";
  const count = config.vitalArticleTileCount;
  const mix = `${count} named ${count === 1 ? "article" : "articles"} · ${config.genericTileCount} flexible ${config.genericTileCount === 1 ? "objective" : "objectives"}`;
  if (!count) return `${mix} · Article difficulty and topic limits do not apply.`;
  const difficulty = { EASY: "Easy", MIXED: "Mixed", HARD: "Hard" }[config.difficulty];
  return `${mix} · ${difficulty} articles · ${config.maxTilesPerTopic === 25 ? "No topic limit" : `Up to ${config.maxTilesPerTopic} per topic`}`;
}
