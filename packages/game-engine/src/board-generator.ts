import type {
  Board,
  BoardSquare,
  Difficulty,
  BoardGenerationConfig,
  BoardDifficulty,
  BoardSetupOptions,
} from "@bingo/shared";
import { DEFAULT_BOARD_CONFIG, boardSetupIssue } from "@bingo/shared";
import { vitalArticles, type VitalArticle } from "./vital-articles.js";

const genericSquareTemplates: Omit<BoardSquare, "id" | "position">[] = [
  {
    type: "TITLE_CONTAINS",
    label: "Visit a page with 'science' in the title",
    condition: { text: "science" },
    difficulty: "EASY",
  },
  {
    type: "TITLE_CONTAINS",
    label: "Visit a page with 'history' in the title",
    condition: { text: "history" },
    difficulty: "EASY",
  },
  {
    type: "TITLE_CONTAINS",
    label: "Visit a page with 'war' in the title",
    condition: { text: "war" },
    difficulty: "MEDIUM",
  },
  {
    type: "TITLE_STARTS_WITH",
    label: "Visit a page starting with A",
    condition: { letter: "A" },
    difficulty: "EASY",
  },
  {
    type: "TITLE_STARTS_WITH",
    label: "Visit a page starting with M",
    condition: { letter: "M" },
    difficulty: "EASY",
  },
  {
    type: "TITLE_STARTS_WITH",
    label: "Visit a page starting with C",
    condition: { letter: "C" },
    difficulty: "EASY",
  },
  {
    type: "CATEGORY_CONTAINS",
    label: "Visit a page in a science category",
    condition: { text: "science" },
    difficulty: "EASY",
  },
  {
    type: "CATEGORY_CONTAINS",
    label: "Visit a page in a history category",
    condition: { text: "history" },
    difficulty: "MEDIUM",
  },
  {
    type: "CATEGORY_CONTAINS",
    label: "Visit a page in a geography category",
    condition: { text: "geography" },
    difficulty: "MEDIUM",
  },
  {
    type: "CATEGORY_CONTAINS",
    label: "Visit a page in a technology category",
    condition: { text: "technology" },
    difficulty: "MEDIUM",
  },
  {
    type: "LINK_COUNT_GREATER_THAN",
    label: "Visit a page with more than 50 links",
    condition: { count: 50 },
    difficulty: "EASY",
  },
  {
    type: "LINK_COUNT_GREATER_THAN",
    label: "Visit a page with more than 100 links",
    condition: { count: 100 },
    difficulty: "MEDIUM",
  },
  {
    type: "LINK_COUNT_GREATER_THAN",
    label: "Visit a page with more than 200 links",
    condition: { count: 200 },
    difficulty: "HARD",
  },
  ...Array.from("BDEFGHIJKLNOPQRSTUVWXYZ", (letter) => ({
    type: "TITLE_STARTS_WITH" as const,
    label: `Visit a page starting with ${letter}`,
    condition: { letter },
    difficulty: "MEDIUM" as const,
  })),
];

// Capacity reporting and selection must use the same distinct, eligible catalog.
const eligibleCatalog = Object.fromEntries((["EASY", "MIXED", "HARD"] as const).map(difficulty => {
  const titles = new Map<string, VitalArticle>();
  for (const article of vitalArticles) {
    if (!articleMatchesDifficulty(article, difficulty)) continue;
    const key = article.title.trim().toLocaleLowerCase("en");
    if (!titles.has(key)) titles.set(key, article);
  }
  return [difficulty, [...titles.values()]];
})) as Record<BoardDifficulty, VitalArticle[]>;

export function getBoardSetupOptions(): BoardSetupOptions {
  return { articleCapacities: Object.fromEntries(Object.entries(eligibleCatalog).map(([difficulty, articles]) => {
    const topics = new Map<string, number>();
    for (const article of articles) topics.set(article.topic ?? "Unknown", (topics.get(article.topic ?? "Unknown") ?? 0) + 1);
    return [difficulty, Array.from({ length: 25 }, (_, index) => Math.min(25,
      [...topics.values()].reduce((total, count) => total + Math.min(count, index + 1), 0)))];
  })) as BoardSetupOptions["articleCapacities"] };
}

export function generateBoard(
  config: BoardGenerationConfig = DEFAULT_BOARD_CONFIG,
): Board {
  if (![config.vitalArticleTileCount, config.genericTileCount].every(
    (count) => Number.isInteger(count) && count >= 0 && count <= 25,
  ) || config.vitalArticleTileCount + config.genericTileCount !== 25) {
    throw new RangeError("Board tile counts must add up to 25");
  }
  if (!Number.isInteger(config.maxTilesPerTopic) || config.maxTilesPerTopic < 1 ||
      config.maxTilesPerTopic > 25 || !["EASY", "MIXED", "HARD"].includes(config.difficulty)) {
    throw new RangeError("Invalid board difficulty or topic limit");
  }
  const issue = boardSetupIssue(config, getBoardSetupOptions());
  if (issue) throw new RangeError(issue);
  const selectedSquares = buildTwentyFiveSquares(config);
  if (selectedSquares.length !== 25) {
    throw new RangeError("Not enough distinct articles for this difficulty and topic limit; increase maxTilesPerTopic or choose more generic tiles");
  }

  return {
    id: crypto.randomUUID(),
    size: 5,
    squares: shuffle(selectedSquares).map((square, index) => ({
      id: crypto.randomUUID(),
      position: index,
      ...square,
    })),
  };
}

function buildTwentyFiveSquares(
  config: BoardGenerationConfig,
): Omit<BoardSquare, "id" | "position">[] {
  const vitalSquares = buildVitalArticleSquares(
    config.vitalArticleTileCount,
    config,
  );

  const genericSquares = shuffle(genericSquareTemplates).slice(
    0,
    config.genericTileCount,
  );

  return [...vitalSquares, ...genericSquares];
}

function buildVitalArticleSquares(
  count: number,
  config: BoardGenerationConfig,
): Omit<BoardSquare, "id" | "position">[] {
  const selectedArticles = selectDiverseVitalArticles(count, config);

  return selectedArticles.map((article) => ({
    type: "VISIT_ARTICLE",
    label: `Visit ${article.title}`,
    condition: { title: article.title },
    difficulty: difficultyFromVitalLevel(article.level),
  }));
}

function selectDiverseVitalArticles(
  count: number,
  config: BoardGenerationConfig,
): VitalArticle[] {
  const shuffledArticles = shuffle(eligibleCatalog[config.difficulty]);

  const selected: VitalArticle[] = [];
  const selectedTitles = new Set<string>();
  const topicCounts = new Map<string, number>();

  for (const article of shuffledArticles) {
    if (selected.length >= count) break;

    const titleKey = article.title.trim().toLocaleLowerCase("en");
    if (selectedTitles.has(titleKey)) continue;
    const topic = article.topic ?? "Unknown";
    const currentTopicCount = topicCounts.get(topic) ?? 0;

    if (currentTopicCount >= config.maxTilesPerTopic) {
      continue;
    }

    selected.push(article);
    selectedTitles.add(titleKey);
    topicCounts.set(topic, currentTopicCount + 1);
  }

  return selected;
}

function articleMatchesDifficulty(
  article: VitalArticle,
  difficulty: BoardDifficulty,
): boolean {
  if (difficulty === "EASY") {
    return article.level <= 3;
  }

  if (difficulty === "HARD") {
    return article.level >= 3;
  }

  return true;
}

function difficultyFromVitalLevel(level: 1 | 2 | 3 | 4): Difficulty {
  if (level <= 2) return "EASY";
  if (level === 3) return "MEDIUM";
  return "HARD";
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];

  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }

  return copy;
}
