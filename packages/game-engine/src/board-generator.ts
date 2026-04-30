import type { Board, BoardSquare, Difficulty } from "@bingo/shared";
import { vitalArticles, type VitalArticle } from "./vital-articles.js";

const GENERIC_TILE_COUNT = 10;
const VITAL_ARTICLE_TILE_COUNT = 15;

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
];

export function generateBoard(): Board {
  const selectedSquares = buildTwentyFiveSquares();

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

function buildTwentyFiveSquares(): Omit<BoardSquare, "id" | "position">[] {
  const vitalSquares = buildVitalArticleSquares(VITAL_ARTICLE_TILE_COUNT);
  const genericSquares = shuffle(genericSquareTemplates).slice(
    0,
    GENERIC_TILE_COUNT,
  );

  return [...vitalSquares, ...genericSquares];
}

function buildVitalArticleSquares(
  count: number,
): Omit<BoardSquare, "id" | "position">[] {
  const selectedArticles = selectDiverseVitalArticles(count);

  return selectedArticles.map((article) => ({
    type: "VISIT_ARTICLE",
    label: `Visit ${article.title}`,
    condition: { title: article.title },
    difficulty: difficultyFromVitalLevel(article.level),
  }));
}

function selectDiverseVitalArticles(count: number): VitalArticle[] {
  const shuffledArticles = shuffle(vitalArticles);
  const selected: VitalArticle[] = [];
  const topicCounts = new Map<string, number>();

  for (const article of shuffledArticles) {
    if (selected.length >= count) break;

    const topic = article.topic ?? "Unknown";
    const currentTopicCount = topicCounts.get(topic) ?? 0;

    if (currentTopicCount >= 3) {
      continue;
    }

    selected.push(article);
    topicCounts.set(topic, currentTopicCount + 1);
  }

  return selected;
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
