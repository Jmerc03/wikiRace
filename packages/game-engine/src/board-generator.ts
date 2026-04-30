import type { Board, BoardSquare } from "@bingo/shared";

const squareTemplates: Omit<BoardSquare, "id" | "position">[] = [
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
    squares: selectedSquares.map((square, index) => ({
      id: crypto.randomUUID(),
      position: index,
      ...square,
    })),
  };
}

function buildTwentyFiveSquares(): Omit<BoardSquare, "id" | "position">[] {
  const squares: Omit<BoardSquare, "id" | "position">[] = [];

  while (squares.length < 25) {
    for (const template of squareTemplates) {
      if (squares.length >= 25) break;
      squares.push(template);
    }
  }

  return squares;
}
